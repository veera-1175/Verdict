import type { AgentIssue, AgentResult, StaticFinding } from "./agentInterface.js";
import type { ChangedFile } from "./changedFile.js";
import { callAgentLlm } from "./llmClient.js";

const DOMAINS: Record<string, string> = {
  Inspection:
    "every file and every language. Missing brackets, unclosed blocks, broken selectors, malformed markup, bad config, logic errors, and small defects that make the file wrong",
  Security: "injection risks, hardcoded secrets, unsafe deserialization, auth bypass, dependency CVEs",
  "Code Quality": "broken structure, dead code, duplication, and complexity that hides a defect",
  Performance: "N+1 queries, unnecessary loops, blocking I/O, memory leaks",
  Architecture: "layering violations, circular dependencies, inconsistent module boundaries",
  Documentation: "docs or comments that describe behavior the code does not have",
  "Best Practices": "error handling that drops failures, and framework misuse that changes behavior",
};

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

const JSON_SHAPE =
  'Return JSON only: { "issues": [{ "file", "line", "title", "description", "evidence", "severity", "suggestedFix", "selfConfidence" }], "summary": "..." }. ' +
  "severity is low, medium, high, or critical. " +
  "evidence is copied exactly from one numbered source line, without the line number. " +
  "line is that line's number. " +
  "description explains the impact in 2–4 sentences. suggestedFix says what to change. " +
  "If the files have no proven defect, return an empty issues array.";

function reviewRules(agentName: string, focus: string): string {
  return (
    `You are the ${agentName} agent in a pull-request review. Look hardest for: ${focus}. ` +
    "Language and file type do not matter. Read the numbered source. " +
    "Report every defect you can prove from that text, including a one-character syntax error. " +
    "A quoted line that is incomplete, unmatched, or inconsistent with the lines around it is a defect. " +
    "Do not report taste, naming preference, or a request to add comments. " +
    "Do not invent a line that is not in the file. " +
    JSON_SHAPE
  );
}

export function numberFile(content: string, maxChars = 14000): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = `${String(i + 1).padStart(4, " ")}| ${lines[i]}`;
    if (used + row.length > maxChars) {
      out.push(`... ${lines.length - i} more lines not shown`);
      break;
    }
    out.push(row);
    used += row.length + 1;
  }
  return out.join("\n");
}

export function buildFileContext(files: ChangedFile[], staticResults: StaticFinding[]): string {
  const fileBlocks = files.slice(0, 20).map((file) => {
    return `FILE: ${file.path}\nPATCH:\n${file.patch.slice(0, 4000)}\nSOURCE:\n${numberFile(file.content)}`;
  });

  const staticBlock = staticResults.slice(0, 40).map(
    (finding) => `[${finding.tool}] ${finding.file}:${finding.line ?? "?"} ${finding.rule} — ${finding.message}`,
  );

  return (
    `${fileBlocks.join("\n\n---\n\n")}\n\n` +
    "Parser hints (confirm each one from SOURCE before reporting it, and add defects they missed):\n" +
    (staticBlock.join("\n") || "(none)")
  );
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fileFor(issueFile: string, files: ChangedFile[]): ChangedFile | undefined {
  const exact = files.find((file) => file.path === issueFile);
  if (exact) return exact;
  const bySuffix = files.find((file) => file.path.endsWith(issueFile) || issueFile.endsWith(file.path));
  if (bySuffix) return bySuffix;
  return files.length === 1 ? files[0] : undefined;
}

function lineContaining(content: string, evidence: string): number | null {
  const lines = content.split(/\r?\n/);
  const quote = evidence.trim();
  const loose = normalize(quote);
  const index = lines.findIndex((line) => line.includes(quote) || normalize(line).includes(loose));
  return index >= 0 ? index + 1 : null;
}

/** Keep an agent issue only when its evidence is actually in the changed file. */
export function verifyIssues(issues: AgentIssue[], files: ChangedFile[]): AgentIssue[] {
  const kept: AgentIssue[] = [];
  for (const issue of issues) {
    const quote = issue.evidence?.trim() ?? "";
    if (quote.length < 2) continue;
    const file = fileFor(issue.file, files);
    if (!file) continue;
    const inFile = file.content.includes(quote) || normalize(file.content).includes(normalize(quote));
    if (!inFile) continue;
    const line = lineContaining(file.content, quote);
    kept.push({
      ...issue,
      file: file.path,
      line: line ?? issue.line,
      severity: SEVERITIES.has(issue.severity) ? issue.severity : "medium",
    });
  }
  return kept;
}

function parseAgentJson(text: string, agentName: string, files: ChangedFile[]): AgentResult {
  try {
    const data = JSON.parse(extractJson(text)) as {
      issues?: AgentIssue[];
      summary?: string;
    };

    const parsed = (data.issues ?? []).map((issue) => ({
      file: issue.file ?? "unknown",
      line: issue.line ?? null,
      title: issue.title ?? "Issue",
      description: issue.description ?? "",
      evidence: issue.evidence ?? "",
      severity: (SEVERITIES.has(issue.severity) ? issue.severity : "medium") as AgentIssue["severity"],
      suggestedFix: issue.suggestedFix ?? "",
      selfConfidence: Math.min(100, Math.max(0, Number(issue.selfConfidence) || 70)),
    }));

    return {
      agentName,
      issues: verifyIssues(parsed, files),
      summary: data.summary ?? `${agentName} review complete`,
    };
  } catch {
    return {
      agentName,
      issues: [],
      summary: `${agentName} returned invalid JSON`,
    };
  }
}

async function askAgent(agentName: string, system: string, user: string, files: ChangedFile[]): Promise<AgentResult> {
  let responseText = "";
  try {
    const first = await callAgentLlm([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    responseText = first.text;
    const parsed = parseAgentJson(responseText, agentName, files);
    if (!parsed.summary.endsWith("invalid JSON")) return parsed;

    const second = await callAgentLlm([
      { role: "system", content: `${system} The previous reply was not JSON. Reply with the JSON object only.` },
      { role: "user", content: user },
    ]);
    return parseAgentJson(second.text, agentName, files);
  } catch (err) {
    return {
      agentName,
      issues: [],
      summary: `${agentName} unavailable: ${(err as Error).message}`,
    };
  }
}

export async function runDomainAgent(
  agentName: keyof typeof DOMAINS,
  files: ChangedFile[],
  staticResults: StaticFinding[],
): Promise<AgentResult> {
  return askAgent(
    agentName,
    reviewRules(agentName, DOMAINS[agentName]),
    buildFileContext(files, staticResults),
    files,
  );
}

export async function runAuditAgent(
  files: ChangedFile[],
  staticResults: StaticFinding[],
  alreadyFound: string[],
): Promise<AgentResult> {
  const listed = alreadyFound.length > 0 ? alreadyFound.map((item) => `- ${item}`).join("\n") : "(none yet)";
  return askAgent(
    "Audit",
    reviewRules(
      "Audit",
      "defects the other agents missed, in any language, including small syntax and structure errors",
    ) + " Do not repeat an issue already listed. Add only what is still wrong.",
    `${buildFileContext(files, staticResults)}\n\nALREADY REPORTED:\n${listed}`,
    files,
  );
}
