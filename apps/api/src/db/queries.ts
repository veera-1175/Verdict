import { getSupabase } from "./client.js";
import { isLocalDbEnabled, localStore } from "./localStore.js";
import type { MergedIssue, ReviewReport } from "../agents/agentInterface.js";
import type { AccessScope } from "../middleware/scope.js";

export interface PullRequestRow {
  id: string;
  repo_id: string;
  pr_number: number;
  title: string | null;
  author: string | null;
  status: string;
  installation_id: number | null;
  head_sha: string | null;
  repo_full_name: string;
}

export function isDbConfigured(): boolean {
  return isLocalDbEnabled() || Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_URL.includes("YOUR_PROJECT") &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("your_"),
  );
}

export async function upsertRepo(params: {
  githubRepoId: number;
  fullName: string;
  installationId?: number;
}): Promise<string> {
  if (isLocalDbEnabled()) {
    return localStore.upsertRepo(params);
  }

  const db = getSupabase();
  const { data: existing } = await db
    .from("repos")
    .select("id")
    .eq("github_repo_id", params.githubRepoId)
    .maybeSingle();

  if (existing?.id) {
    return existing.id as string;
  }

  const { data, error } = await db
    .from("repos")
    .insert({
      github_repo_id: params.githubRepoId,
      full_name: params.fullName,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function upsertPullRequest(params: {
  repoId: string;
  prNumber: number;
  title: string;
  author: string;
  installationId: number;
  headSha: string;
}): Promise<string> {
  if (isLocalDbEnabled()) {
    return localStore.upsertPullRequest(params);
  }

  const db = getSupabase();
  const { data: existing } = await db
    .from("pull_requests")
    .select("id")
    .eq("repo_id", params.repoId)
    .eq("pr_number", params.prNumber)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from("pull_requests")
      .update({
        title: params.title,
        author: params.author,
        status: "reviewing",
        installation_id: params.installationId,
        head_sha: params.headSha,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data, error } = await db
    .from("pull_requests")
    .insert({
      repo_id: params.repoId,
      pr_number: params.prNumber,
      title: params.title,
      author: params.author,
      status: "reviewing",
      installation_id: params.installationId,
      head_sha: params.headSha,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function getPullRequestRow(prId: string): Promise<PullRequestRow> {
  if (isLocalDbEnabled()) {
    const pr = localStore.getPullRequest(prId);
    if (!pr) throw new Error(`PR not found: ${prId}`);
    return pr;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("pull_requests")
    .select("id, repo_id, pr_number, title, author, status, installation_id, head_sha, repos(full_name)")
    .eq("id", prId)
    .single();

  if (error || !data) {
    throw new Error(`PR not found: ${prId}`);
  }

  const repos = data.repos as { full_name: string } | { full_name: string }[] | null;
  const fullName = Array.isArray(repos) ? repos[0]?.full_name : repos?.full_name;

  return {
    id: data.id as string,
    repo_id: data.repo_id as string,
    pr_number: data.pr_number as number,
    title: data.title as string | null,
    author: data.author as string | null,
    status: data.status as string,
    installation_id: data.installation_id as number | null,
    head_sha: data.head_sha as string | null,
    repo_full_name: fullName ?? "unknown/unknown",
  };
}

export async function saveReport(prId: string, report: ReviewReport): Promise<string> {
  if (isLocalDbEnabled()) {
    return localStore.saveReport(prId, report);
  }

  const db = getSupabase();

  const { data: reportRow, error: reportError } = await db
    .from("review_reports")
    .insert({
      pr_id: prId,
      summary: report.summary,
      overall_score: report.overallScore,
    })
    .select("id")
    .single();

  if (reportError) throw reportError;

  const reportId = reportRow.id as string;

  if (report.issues.length > 0) {
    const rows = report.issues.map((issue: MergedIssue) => ({
      report_id: reportId,
      agent_source: issue.agentSources.join(", "),
      file_path: issue.file,
      line_number: issue.line,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      evidence: issue.evidence,
      suggested_fix: issue.suggestedFix,
      confidence_score: issue.verifiedConfidence,
      confidence_explanation: issue.confidenceExplanation,
    }));

    const { error: issuesError } = await db.from("issues").insert(rows);
    if (issuesError) throw issuesError;
  }

  await db.from("pull_requests").update({ status: "reviewed" }).eq("id", prId);

  return reportId;
}

export async function setPullRequestStatus(prId: string, status: string): Promise<void> {
  if (isLocalDbEnabled()) {
    localStore.setPullRequestStatus(prId, status);
    return;
  }

  const db = getSupabase();
  await db.from("pull_requests").update({ status }).eq("id", prId);
}

export async function listReposWithHealth(scope?: AccessScope) {
  if (isLocalDbEnabled()) {
    return localStore.listReposWithHealth(scope);
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("repos")
    .select("id, github_repo_id, full_name, installed_at")
    .order("installed_at", { ascending: false });

  if (error) throw error;

  const repos = data ?? [];
  return Promise.all(
    repos.map(async (repo) => {
      const { data: prs } = await db.from("pull_requests").select("id").eq("repo_id", repo.id);
      if (!prs?.length) return { ...repo, health_score: null, pr_count: 0 };

      const prIds = prs.map((p) => p.id as string);
      const { data: reports } = await db
        .from("review_reports")
        .select("overall_score, pr_id, created_at")
        .in("pr_id", prIds)
        .order("created_at", { ascending: false });

      const latestByPr = new Map<string, number>();
      for (const report of reports ?? []) {
        const pid = report.pr_id as string;
        if (!latestByPr.has(pid) && report.overall_score !== null) {
          latestByPr.set(pid, report.overall_score as number);
        }
      }

      const scores = [...latestByPr.values()];
      const healthScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      return { ...repo, health_score: healthScore, pr_count: prs.length };
    }),
  );
}

export async function listPullRequests(repoId: string, scope?: AccessScope) {
  if (isLocalDbEnabled()) {
    return localStore.listPullRequests(repoId, scope);
  }

  const { data, error } = await getSupabase()
    .from("pull_requests")
    .select("id, pr_number, title, author, status, created_at")
    .eq("repo_id", repoId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getLatestReport(prId: string) {
  if (isLocalDbEnabled()) {
    return localStore.getLatestReport(prId);
  }

  const db = getSupabase();
  const { data: report, error: reportError } = await db
    .from("review_reports")
    .select("id, summary, overall_score, created_at")
    .eq("pr_id", prId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError) throw reportError;
  if (!report) return null;

  const { data: issues, error: issuesError } = await db
    .from("issues")
    .select("*")
    .eq("report_id", report.id)
    .order("confidence_score", { ascending: false });

  if (issuesError) throw issuesError;
  return { report, issues: issues ?? [] };
}
