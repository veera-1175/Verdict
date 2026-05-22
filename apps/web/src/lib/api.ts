import { getApiBase } from "./apiBase";

const STORAGE_KEY = "verdict-auth-user";

export function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const user = JSON.parse(raw) as {
      id?: string;
      role?: string;
      github_username?: string;
      org_id?: string | null;
    };
    const headers: Record<string, string> = {};
    if (user.id) headers["X-Verdict-User-Id"] = user.id;
    if (user.role) headers["X-Verdict-Role"] = user.role;
    if (user.github_username) headers["X-Verdict-Github-Username"] = user.github_username;
    if (user.org_id) headers["X-Verdict-Org-Id"] = user.org_id;
    return headers;
  } catch {
    return {};
  }
}

async function parseError(res: Response, path: string): Promise<never> {
  let message = `API ${path}: ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, path);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res, path);
}

export interface RepoRow {
  id: string;
  github_repo_id: number;
  full_name: string;
  installation_id?: number | null;
  installed_at: string;
  health_score: number | null;
  pr_count: number;
}

export interface GitHubRepoOption {
  github_repo_id: number;
  full_name: string;
  installation_id: number;
  private: boolean;
  description: string | null;
  app_has_access: boolean;
  registered: boolean;
}

export interface GitHubCollaboratorRow {
  login: string;
  name: string;
  avatar_url: string | null;
  role: string | null;
  has_login: boolean;
}

export interface CollaboratorsResponse {
  full_name: string;
  installation_id: number;
  github_repo_id: number;
  collaborators: GitHubCollaboratorRow[];
}

export interface DeveloperFromGithubResponse {
  id: string;
  email: string;
  name: string;
  role: "developer";
  github_username: string;
  created_at: string;
  default_password: string;
}

export interface PRRow {
  id: string;
  pr_number: number;
  title: string | null;
  author: string | null;
  status: string;
  created_at: string;
}

export interface TeamMemberRow {
  id: string;
  email: string;
  name: string;
  role: "developer";
  github_username: string;
  created_at: string;
}

export interface OpenPullRow {
  number: number;
  title: string;
  author: string;
  head_sha: string;
  html_url: string;
  updated_at: string;
  verdict_pr_id: string | null;
  verdict_status: string | null;
  has_report: boolean;
  overall_score: number | null;
}

export interface OpenPullsResponse {
  full_name: string;
  registered?: boolean;
  repo_id: string | null;
  pulls: OpenPullRow[];
}

export interface PRMeta {
  id: string;
  repo_id: string;
  pr_number: number;
  title: string | null;
  author: string | null;
  status: string;
  repo_full_name: string;
  github_url: string;
}

export interface PlatformHealth {
  ok: boolean;
  service: string;
  localDb: boolean;
  db: boolean;
  githubApp: boolean;
  llm: { groq: boolean; gemini: boolean };
}

export interface TriggerReviewResponse {
  accepted: boolean;
  pr_id: string;
  repo_id?: string;
  message: string;
}

export interface DemoReviewResponse {
  ok: boolean;
  message: string;
  repoId: string;
  prId: string;
  dashboard_url: string;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PasswordChangeRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: string;
  created_at: string;
}

export interface GitHubUserResult {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  has_login: boolean;
}
