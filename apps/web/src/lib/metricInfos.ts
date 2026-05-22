export interface PanelInfo {
  id: string;
  category: string;
  title: string;
  description: string;
  bullets?: string[];
  stats?: { label: string; value: string }[];
  action?: { label: string; path: string };
}

export const DASHBOARD_METRICS: Record<string, PanelInfo> = {
  repos: {
    id: "repos",
    category: "Dashboard",
    title: "Repositories",
    description: "GitHub repos registered with the Verdict App. Reviews run when PRs are opened or triggered from Settings.",
    bullets: ["Admin registers repos in Settings", "Health score averages PR scores per repo"],
  },
  prs: {
    id: "prs",
    category: "Dashboard",
    title: "Pull requests reviewed",
    description: "Total PRs processed by the 6-agent pipeline and master merge agent.",
    bullets: ["Developers see only PRs they authored", "Status: reviewing → reviewed or failed"],
  },
  issues: {
    id: "issues",
    category: "Dashboard",
    title: "Issues found",
    description: "Deduped findings from Security, Quality, Performance, Architecture, Documentation, and Best Practices agents.",
    bullets: ["Each issue has a confidence score", "Critical/high issues can fail the GitHub check run"],
  },
  health: {
    id: "health",
    category: "Dashboard",
    title: "Average health score",
    description: "Overall PR quality score (0–100) from the master agent after merging all agent outputs.",
    bullets: ["Below 60 fails the GitHub Check Run by default", "Formula weights agent confidence + static analysis"],
  },
  activity: {
    id: "activity",
    category: "Dashboard",
    title: "Recent activity",
    description: "Latest reviewed pull requests with scores and links to full reports.",
  },
};

export const ANALYTICS_METRICS: Record<string, PanelInfo> = {
  avg_score: {
    id: "avg_score",
    category: "Analytics",
    title: "Average score",
    description: "Mean overall health score across all visible PR reports in your scope.",
  },
  total_issues: {
    id: "total_issues",
    category: "Analytics",
    title: "Total issues",
    description: "Count of merged issues from all agent reports — deduplicated by the master agent.",
  },
  severity: {
    id: "severity",
    category: "Analytics",
    title: "Issues by severity",
    description: "Breakdown of critical, high, medium, and low findings. Critical and high drive check-run failures.",
  },
  agents: {
    id: "agents",
    category: "Analytics",
    title: "Findings by agent",
    description: "Which specialist agents contributed the most findings across all reviews.",
    action: { label: "View agent pipeline", path: "/agents" },
  },
  confidence: {
    id: "confidence",
    category: "Analytics",
    title: "Confidence formula",
    description: "Deterministic scoring — not LLM self-report alone. Static analysis and cross-agent agreement boost confidence.",
    bullets: [
      "40% agent self-assessment",
      "30% static tool agreement (ESLint, Semgrep)",
      "20% cross-agent corroboration",
      "10% evidence specificity",
    ],
  },
  history: {
    id: "history",
    category: "Analytics",
    title: "Review history",
    description: "Chronological list of completed reviews with repo, PR number, and score.",
  },
};
