import type { AgentIssue, AgentResult, StaticFinding } from "./agentInterface.js";
import type { ChangedFile } from "./changedFile.js";
import { callAgentLlm } from "./llmClient.js";

const DOMAINS: Record<string, string> = {
  Security: "injection risks, hardcoded secrets, unsafe deserialization, auth bypass, dependency CVEs",
  "Code Quality": "naming, duplication, dead code, function length, complexity",
  Performance: "N+1 queries, unnecessary loops, blocking I/O, memory leaks",
  Architecture: "layering violations, circular dependencies, inconsistent module boundaries",
  Documentation: "missing docstrings on public functions, unclear parameter names, stale README references",
  "Best Practices": "language/framework idioms, error handling conventions, missing test coverage on changed files",
};

function buildFileContext(files: ChangedFile[], staticResults: StaticFinding[]): string {
  const fileBlocks = files.slice(0, 12).map((f) => {
    const preview = f.content.slice(0, 2500);
    return `FILE: ${f.path}\nPATCH:\n${f.patch.slice(0, 1500)}\nCONTENT:\n${preview}`;
  });

  const staticBlock = staticResults.slice(0, 30).map(
    (s) => `[${s.tool}] ${s.file}:${s.line ?? "?"} ${s.rule} — ${s.message}`,
  );

  return `${fileBlocks.join("\n\n---\n\n")}\n\nSTATIC FINDINGS:\n${staticBlock.join("\n")}`;
}

function parseAgentJson(text: string, agentName: string): AgentResult {
  try {
    const data = JSON.parse(text) as {
      issues?: AgentIssue[];
      summary?: string;
    };

    const issues = (data.issues ?? []).map((issue) => ({
      file: issue.file ?? "unknown",
      line: issue.line ?? null,
      title: issue.title ?? "Issue",
      description: issue.description ?? "",
      evidence: issue.evidence ?? "",
      severity: issue.severity ?? "medium",
      suggestedFix: issue.suggestedFix ?? "",
      selfConfidence: Math.min(100, Math.max(0, Number(issue.selfConfidence) || 50)),
    }));

    return {
      agentName,
      issues,
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

export async function runDomainAgent(
  agentName: keyof typeof DOMAINS,
  files: ChangedFile[],
  staticResults: StaticFinding[],
): Promise<AgentResult> {
  const focus = DOMAINS[agentName];

  try {
    const response = await callAgentLlm([
      {
        role: "system",
        content:
          `You are the ${agentName} agent for Verdict PR reviews. Focus on: ${focus}. ` +
          "Return JSON only: { \"issues\": [{ \"file\", \"line\", \"title\", \"description\", \"evidence\", \"severity\", \"suggestedFix\", \"selfConfidence\" }], \"summary\": \"...\" }. " +
          "Every issue MUST quote exact evidence from the diff/content. severity: low|medium|high|critical. " +
          "description: 2–4 sentences explaining why this matters (risk, impact, who is affected). " +
          "suggestedFix: a concrete remediation — what to change, where, and how (steps or a short code snippet). " +
          "Do not repeat the title in description/suggestedFix. Prefer actionable fixes over vague advice.",
      },
      {
        role: "user",
        content: buildFileContext(files, staticResults),
      },
    ]);

    return parseAgentJson(response.text, agentName);
  } catch (err) {
    return {
      agentName,
      issues: [],
      summary: `${agentName} unavailable: ${(err as Error).message}`,
    };
  }
}
