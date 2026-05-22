import type {
  AgentIssue,
  AgentResult,
  MergedIssue,
  ReviewReport,
  StaticFinding,
} from "./agentInterface.js";
import type { ChangedFile } from "./changedFile.js";
import { callMasterLlm } from "./llmClient.js";
import {
  computeVerifiedConfidence,
  crossAgentAgreement,
  evidenceSpecificity,
  flattenAgentResults,
  staticAnalysisAgreement,
} from "../confidence.js";

const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function issuesMatch(a: AgentIssue, b: AgentIssue): boolean {
  if (a.file !== b.file) return false;

  if (a.line !== null && b.line !== null && Math.abs(a.line - b.line) <= 5) {
    return titleSimilarity(a.title, b.title) >= 0.3;
  }

  return titleSimilarity(a.title, b.title) >= 0.6;
}

function buildConfidenceExplanation(params: {
  agentSelfConfidence: number;
  staticAnalysisAgreement: number;
  crossAgentAgreement: number;
  evidenceSpecificity: number;
  verified: number;
}): string {
  return (
    `Verified confidence ${params.verified}% = ` +
    `40% agent (${params.agentSelfConfidence}) + ` +
    `30% static (${params.staticAnalysisAgreement}) + ` +
    `20% cross-agent (${params.crossAgentAgreement}) + ` +
    `10% evidence (${params.evidenceSpecificity})`
  );
}

export function mergeAgentIssues(
  results: AgentResult[],
  staticFindings: StaticFinding[],
  files: ChangedFile[],
): MergedIssue[] {
  const flat = flattenAgentResults(results);
  const fileContents = new Map(files.map((f) => [f.path, f.content]));
  const merged: MergedIssue[] = [];

  for (const issue of flat) {
    const existing = merged.find((m) => issuesMatch(m, issue));

    if (existing) {
      if (!existing.agentSources.includes(issue.agentName)) {
        existing.agentSources.push(issue.agentName);
      }
      if ((SEVERITY_RANK[issue.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
        existing.severity = issue.severity;
      }
      if (issue.selfConfidence > existing.selfConfidence) {
        existing.selfConfidence = issue.selfConfidence;
        existing.evidence = issue.evidence || existing.evidence;
        existing.suggestedFix = issue.suggestedFix || existing.suggestedFix;
        existing.description = issue.description || existing.description;
      }
      continue;
    }

    const content = fileContents.get(issue.file) ?? "";
    const staticAgree = staticAnalysisAgreement(issue, staticFindings);
    const crossAgree = crossAgentAgreement(issue, flat);
    const evidenceSpec = evidenceSpecificity(issue, content);
    const verified = computeVerifiedConfidence({
      agentSelfConfidence: issue.selfConfidence,
      staticAnalysisAgreement: staticAgree,
      crossAgentAgreement: crossAgree,
      evidenceSpecificity: evidenceSpec,
    });

    merged.push({
      ...issue,
      agentSources: [issue.agentName],
      verifiedConfidence: verified,
      confidenceExplanation: buildConfidenceExplanation({
        agentSelfConfidence: issue.selfConfidence,
        staticAnalysisAgreement: staticAgree,
        crossAgentAgreement: crossAgree,
        evidenceSpecificity: evidenceSpec,
        verified,
      }),
    });
  }

  return merged.sort((a, b) => b.verifiedConfidence - a.verifiedConfidence);
}

export function computeOverallScore(issues: MergedIssue[]): number {
  if (issues.length === 0) return 100;

  const weights = { critical: 25, high: 12, medium: 6, low: 2 };
  let penalty = 0;

  for (const issue of issues) {
    const w = weights[issue.severity as keyof typeof weights] ?? 5;
    penalty += w * (issue.verifiedConfidence / 100);
  }

  return Math.max(0, Math.round(100 - penalty));
}

function fallbackSummary(issues: MergedIssue[], score: number): string {
  const critical = issues.filter((i) => i.severity === "critical" || i.severity === "high");
  if (issues.length === 0) {
    return `No issues detected. Overall health score: ${score}/100.`;
  }
  return (
    `Found ${issues.length} issue(s)` +
    (critical.length > 0 ? ` including ${critical.length} high/critical.` : ".") +
    ` Overall health score: ${score}/100.`
  );
}

export async function runMasterAgent(
  results: AgentResult[],
  staticFindings: StaticFinding[],
  files: ChangedFile[],
): Promise<ReviewReport> {
  const issues = mergeAgentIssues(results, staticFindings, files);
  const overallScore = computeOverallScore(issues);

  let summary = fallbackSummary(issues, overallScore);

  try {
    const issueDigest = issues.slice(0, 15).map((i) => ({
      file: i.file,
      line: i.line,
      severity: i.severity,
      title: i.title,
      confidence: i.verifiedConfidence,
      agents: i.agentSources,
    }));

    const response = await callMasterLlm([
      {
        role: "system",
        content:
          "You are the Verdict master review agent. Write a concise 2-4 sentence executive summary for a PR review. " +
          'Return JSON: { "summary": "..." }',
      },
      {
        role: "user",
        content: JSON.stringify({ overallScore, issues: issueDigest }),
      },
    ]);

    const parsed = JSON.parse(response.text) as { summary?: string };
    if (parsed.summary?.trim()) {
      summary = parsed.summary.trim();
    }
  } catch (err) {
    console.warn("[master] summary fallback:", (err as Error).message);
  }

  return { summary, overallScore, issues };
}
