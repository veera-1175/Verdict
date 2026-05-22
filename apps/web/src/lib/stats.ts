import { authHeaders } from "./api";
import { getApiBase } from "./apiBase";

export interface PlatformStats {
  total_repos: number;
  total_prs: number;
  total_issues: number;
  avg_score: number | null;
  issues_by_severity: Record<string, number>;
  issues_by_agent: Record<string, number>;
  recent_activity: Array<{
    pr_id: string;
    pr_number: number;
    title: string | null;
    repo: string;
    status: string;
    score: number | null;
    reviewed_at: string;
  }>;
}

export interface AgentFinding {
  id: string;
  pr_id: string;
  pr_number: number;
  pr_title: string | null;
  repo: string;
  severity: string | null;
  title: string | null;
  file_path: string | null;
  line_number: number | null;
  confidence_score: number | null;
  description: string | null;
}

export async function fetchStats<T>(path = "/api/stats"): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchAgentFindings(agent: string): Promise<AgentFinding[]> {
  const res = await fetch(
    `${getApiBase()}/api/stats/findings?agent=${encodeURIComponent(agent)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`API findings: ${res.status}`);
  const data = (await res.json()) as { findings: AgentFinding[] };
  return data.findings;
}
