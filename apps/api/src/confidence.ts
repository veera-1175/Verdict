import type { AgentIssue, AgentResult, StaticFinding } from "./agents/agentInterface.js";

export function computeVerifiedConfidence(params: {
  agentSelfConfidence: number;
  staticAnalysisAgreement: number;
  crossAgentAgreement: number;
  evidenceSpecificity: number;
}): number {
  const raw =
    0.4 * params.agentSelfConfidence +
    0.3 * params.staticAnalysisAgreement +
    0.2 * params.crossAgentAgreement +
    0.1 * params.evidenceSpecificity;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function staticAnalysisAgreement(
  issue: AgentIssue,
  staticFindings: StaticFinding[],
): number {
  const sameLine = staticFindings.some(
    (f) => f.file === issue.file && f.line !== null && f.line === issue.line,
  );
  if (sameLine) return 100;

  const sameFile = staticFindings.some((f) => f.file === issue.file);
  if (sameFile) return 50;

  return 0;
}

export function crossAgentAgreement(
  issue: AgentIssue,
  allIssues: Array<AgentIssue & { agentName: string }>,
): number {
  const others = allIssues.filter((i) => i.file === issue.file);
  if (others.length <= 1) return 0;

  const nearby = others.filter((i) => {
    if (i.line === null || issue.line === null) return true;
    return Math.abs(i.line - issue.line) <= 5;
  });

  if (nearby.length >= 2) return 100;
  if (others.length >= 2) return 50;
  return 0;
}

export function evidenceSpecificity(issue: AgentIssue, fileContent: string): number {
  const evidence = issue.evidence.trim();
  if (!evidence || evidence.length < 8) return 0;

  const snippet = evidence.replace(/^["'`]|["'`]$/g, "").slice(0, 80);
  if (snippet.length >= 8 && fileContent.includes(snippet)) {
    return 100;
  }

  const words = snippet.split(/\s+/).filter((w) => w.length > 4);
  const hits = words.filter((w) => fileContent.includes(w)).length;
  if (words.length > 0 && hits / words.length >= 0.5) return 70;

  return 40;
}

export function flattenAgentResults(results: AgentResult[]): Array<AgentIssue & { agentName: string }> {
  const flat: Array<AgentIssue & { agentName: string }> = [];
  for (const result of results) {
    for (const issue of result.issues) {
      flat.push({ ...issue, agentName: result.agentName });
    }
  }
  return flat;
}
