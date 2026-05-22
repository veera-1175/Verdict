export interface AgentIssue {
  file: string;
  line: number | null;
  title: string;
  description: string;
  evidence: string;
  severity: "low" | "medium" | "high" | "critical";
  suggestedFix: string;
  selfConfidence: number;
}

export interface AgentResult {
  agentName: string;
  issues: AgentIssue[];
  summary: string;
}

export interface StaticFinding {
  tool: "eslint" | "semgrep";
  file: string;
  line: number | null;
  rule: string;
  message: string;
  severity: string;
}

export interface MergedIssue extends AgentIssue {
  agentSources: string[];
  verifiedConfidence: number;
  confidenceExplanation: string;
}

export interface ReviewReport {
  summary: string;
  overallScore: number;
  issues: MergedIssue[];
}
