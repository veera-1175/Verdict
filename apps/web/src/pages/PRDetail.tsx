import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, type PRMeta } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canExport } from "../lib/roles";

interface ReportPayload {
  report: {
    summary: string | null;
    overall_score: number | null;
  };
  issues: Array<{
    id: string;
    agent_source: string;
    file_path: string;
    line_number: number | null;
    severity: string;
    title: string;
    description: string | null;
    confidence_score: number;
    confidence_explanation: string | null;
    evidence: string;
    suggested_fix: string;
  }>;
}

function severityTag(severity: string) {
  if (severity === "critical") return "tag border-white bg-white text-black";
  if (severity === "high") return "tag border-white text-white";
  if (severity === "medium") return "tag border-ink-400";
  return "tag";
}

function hasUsefulEvidence(evidence: string | null | undefined) {
  const t = (evidence ?? "").trim();
  return t.length > 2 && t !== "-" && t !== "-\n";
}

interface CommitReview {
  sha: string;
  message: string;
  committedAt: string;
  score: number | null;
}

interface ShownIssue {
  id: string;
  agent_source: string;
  file_path: string;
  line_number: number | null;
  severity: string;
  title: string;
  description: string | null;
  confidence_score: number;
  confidence_explanation: string | null;
  evidence: string;
  suggested_fix: string;
}

interface LatestReview {
  score: number | null;
  summary: string;
  issues: ShownIssue[];
}

function scoreFromVerdictComment(body: string): number | null {
  const match = body.match(/Overall health score:\*\*\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseVerdictComment(body: string): LatestReview {
  const score = scoreFromVerdictComment(body);
  const summary = (body.split(/### /)[0] ?? "")
    .replace(/## Verdict[\s\S]*?\*\*Overall health score:\*\*\s*\d+\/100/i, "")
    .replace(/\[View full report[\s\S]*$/, "")
    .trim();
  const blocks = body.split(/\n#### /).slice(1);
  const issues = blocks.map((block, index) => {
    const heading = block.split("\n")[0] ?? "";
    const headingMatch = heading.match(/^(critical|high|medium|low)\s+[—–-]\s+(.+)$/i);
    const loc = block.match(/`([^`\n]+)`(?:\s+·\s+(\d+)%)?/);
    const place = loc?.[1] ?? "";
    const lineRaw = place.includes(":") ? place.split(":").pop() : "";
    const lineNumber = lineRaw && /^\d+$/.test(lineRaw) ? Number(lineRaw) : null;
    const filePath = lineNumber == null ? place : place.slice(0, place.lastIndexOf(":"));
    const evidence = block.match(/Evidence: (.+)/)?.[1]?.trim() ?? "";
    const suggested = block.match(/\*\*How to fix:\*\*\s*([\s\S]*?)(?:\n#### |\n\[View full|$)/)?.[1]?.trim() ?? "";
    const description = block
      .split("\n")
      .slice(1)
      .join("\n")
      .replace(/`[^`]+`[^\n]*% confidence/, "")
      .replace(/Evidence: .+\n?/, "")
      .replace(/\*\*How to fix:\*\*[\s\S]*/, "")
      .trim();
    return {
      id: `github-${index}`,
      agent_source: "Review",
      file_path: filePath,
      line_number: lineNumber,
      severity: (headingMatch?.[1] ?? "medium").toLowerCase(),
      title: (headingMatch?.[2] ?? heading).trim(),
      description: description || null,
      confidence_score: loc?.[2] ? Number(loc[2]) : 0,
      confidence_explanation: null,
      evidence,
      suggested_fix: suggested,
    };
  });
  return { score, summary, issues };
}

async function loadCommitReviews(repo: string, prNumber: number): Promise<{ commits: CommitReview[]; latest: LatestReview | null }> {
  const headers = { Accept: "application/vnd.github+json" };
  const [commitRes, commentRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/commits?per_page=100`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`, { headers }),
  ]);
  if (!commitRes.ok || !commentRes.ok) return { commits: [], latest: null };

  const commits = (await commitRes.json()) as Array<{
    sha: string;
    commit?: { message?: string; author?: { date?: string } };
  }>;
  const comments = (await commentRes.json()) as Array<{ body?: string; created_at?: string }>;
  if (!Array.isArray(commits)) return { commits: [], latest: null };

  const reviews = (Array.isArray(comments) ? comments : [])
    .filter((comment) => (comment.body ?? "").includes("## Verdict") && (comment.body ?? "").includes("Overall health score"))
    .map((comment) => ({
      at: new Date(comment.created_at ?? 0).getTime(),
      body: comment.body ?? "",
      score: scoreFromVerdictComment(comment.body ?? ""),
    }))
    .sort((a, b) => a.at - b.at);

  const rows = commits.map((commit, index) => {
    const start = new Date(commit.commit?.author?.date ?? 0).getTime();
    const end = index + 1 < commits.length ? new Date(commits[index + 1].commit?.author?.date ?? 0).getTime() : Number.POSITIVE_INFINITY;
    const inWindow = reviews.filter((review) => review.at >= start && review.at < end);
    const chosen = inWindow[inWindow.length - 1];
    return {
      sha: commit.sha.slice(0, 7),
      message: (commit.commit?.message ?? "Commit").split("\n")[0],
      committedAt: commit.commit?.author?.date ?? "",
      score: chosen?.score ?? null,
    };
  });

  const newest = reviews[reviews.length - 1];
  return { commits: rows, latest: newest ? parseVerdictComment(newest.body) : null };
}

export function PRDetail() {
  const { prId } = useParams();
  const { user } = useAuth();
  const [meta, setMeta] = useState<PRMeta | null>(null);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [commitReviews, setCommitReviews] = useState<CommitReview[]>([]);
  const [latestReview, setLatestReview] = useState<LatestReview | null>(null);

  useEffect(() => {
    if (!prId) return;
    apiGet<PRMeta>(`/api/prs/${prId}`)
      .then(setMeta)
      .catch((e: Error) => setError(e.message));
    apiGet<ReportPayload>(`/api/prs/${prId}/report`)
      .then(setData)
      .catch(() => setData(null));
  }, [prId]);

  useEffect(() => {
    if (!meta?.repo_full_name || !meta.pr_number) return;
    let cancelled = false;
    loadCommitReviews(meta.repo_full_name, meta.pr_number)
      .then((loaded) => {
        if (!cancelled) {
          setCommitReviews(loaded.commits);
          setLatestReview(loaded.latest);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommitReviews([]);
          setLatestReview(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  const storedScore = data?.report.overall_score ?? null;
  const githubHasFindings = (latestReview?.issues.length ?? 0) > 0;
  const storedHasFindings = (data?.issues.length ?? 0) > 0;
  const showGitHubReview =
    githubHasFindings &&
    (!storedHasFindings || (latestReview?.score != null && storedScore != null && latestReview.score < storedScore));
  const shownIssues = showGitHubReview ? latestReview!.issues : (data?.issues ?? []);
  const score = showGitHubReview && latestReview?.score != null ? latestReview.score : (storedScore ?? latestReview?.score ?? 0);
  const summary = showGitHubReview ? latestReview?.summary : data?.report.summary;

  const filtered = useMemo(() => {
    return shownIssues.filter((issue) => {
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (agentFilter !== "all" && !issue.agent_source.includes(agentFilter)) return false;
      return true;
    });
  }, [shownIssues, severityFilter, agentFilter]);

  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const issue of shownIssues) {
      for (const agent of issue.agent_source.split(",").map((part) => part.trim())) {
        if (agent) set.add(agent);
      }
    }
    return [...set];
  }, [shownIssues]);

  function exportReport() {
    const payload = showGitHubReview
      ? { meta, report: { summary, overall_score: score }, issues: shownIssues }
      : { meta, ...data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdict-report-${prId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-8">
      <p className="mono-label">
        <Link to="/" className="row-link">Dashboard</Link>
        {meta && (
          <>
            <span className="text-ink-600"> / </span>
            <Link to={`/repos/${meta.repo_id}`} className="row-link">{meta.repo_full_name}</Link>
          </>
        )}
        <span className="text-ink-600"> / PR report</span>
      </p>

      {meta && (
        <div className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono-label">{meta.repo_full_name} · #{meta.pr_number}</p>
              <h2 className="mt-2 text-xl font-bold text-white">{meta.title ?? "Untitled PR"}</h2>
              <p className="mt-2 font-mono text-xs text-ink-400">
                @{meta.author ?? "unknown"} · <span className="tag">{meta.status}</span>
              </p>
            </div>
            <a className="btn-ghost text-xs" href={meta.github_url} target="_blank" rel="noreferrer">
              View on GitHub →
            </a>
          </div>
        </div>
      )}

      {commitReviews.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="border-b border-ink-700 px-6 py-4">
            <p className="mono-label">Reviews for each commit</p>
            <p className="section-desc mt-3">
              This pull request has {commitReviews.length} commit{commitReviews.length === 1 ? "" : "s"}. A score is shown when a review was posted for that commit. The health number below is the latest review.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left">
                <th className="mono-label px-6 py-3">Commit</th>
                <th className="mono-label px-6 py-3">Change</th>
                <th className="mono-label px-6 py-3">Health</th>
              </tr>
            </thead>
            <tbody>
              {commitReviews.map((commit) => (
                <tr key={commit.sha} className="table-row">
                  <td className="px-6 py-4 font-mono text-xs text-ink-300">{commit.sha}</td>
                  <td className="px-6 py-4">
                    <p className="text-white">{commit.message}</p>
                    {commit.committedAt && (
                      <p className="mt-1 font-mono text-xs text-ink-400">
                        {new Date(commit.committedAt).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-200">
                    {commit.score == null ? "—" : `${commit.score}/100`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
      )}

      {!data && !error && (
        <div className="panel p-8 text-center text-ink-400">
          {meta?.status === "reviewing"
            ? "Review in progress — refresh in a minute."
            : "No report yet for this pull request."}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div
              className={`kpi-card flex h-36 w-36 shrink-0 items-center justify-center ${
                score >= 80 ? "border-white/30" : score >= 60 ? "border-ink-400" : "border-ink-600"
              }`}
            >
              <div className="text-center">
                <p className="stat-value text-5xl">{score}</p>
                <p className="mono-label mt-2">Health</p>
              </div>
            </div>
            <div className="flex-1">
              <p className="mono-label">Review summary</p>
              <p className="section-desc mt-3">{summary || "No summary yet."}</p>
              {user && canExport(user.role) && (
                <button type="button" className="btn-ghost mt-6" onClick={exportReport}>
                  ↓ Export JSON
                </button>
              )}
            </div>
          </div>

          <div className="panel flex flex-wrap items-end gap-6 p-6">
            <div>
              <label className="mono-label mb-2 block">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="input-ink w-40"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="mono-label mb-2 block">Agent</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="input-ink w-48"
              >
                <option value="all">All agents</option>
                {agents.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <span className="tag">{filtered.length} issue(s)</span>
          </div>

          {filtered.length === 0 && (
            <div className="panel p-8 text-center text-ink-400">No issues match filters.</div>
          )}

          <div className="space-y-4">
            {filtered.map((issue) => {
              const isPriority = issue.severity === "critical" || issue.severity === "high";
              return (
                <details
                  key={issue.id}
                  className="panel group open:border-white/30"
                  open={isPriority}
                >
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-6 py-4">
                    <span className={severityTag(issue.severity)}>{issue.severity}</span>
                    <span className="font-mono text-xs text-ink-300">
                      {issue.file_path}
                      {issue.line_number ? `:${issue.line_number}` : ""}
                    </span>
                    <span className="flex-1 font-medium text-white">{issue.title}</span>
                    <span
                      className="tag border-white/40"
                      title={issue.confidence_explanation ?? "Model confidence in this finding"}
                    >
                      {issue.confidence_score}% confident
                    </span>
                  </summary>

                  <div className="space-y-5 border-t border-ink-800 px-6 py-5">
                    {issue.description && (
                      <div>
                        <p className="mono-label mb-2">What’s wrong</p>
                        <p className="text-sm leading-relaxed text-ink-100">{issue.description}</p>
                      </div>
                    )}

                    {hasUsefulEvidence(issue.evidence) && (
                      <div>
                        <p className="mono-label mb-2">Evidence from the PR</p>
                        <pre className="overflow-x-auto border border-ink-700 bg-black p-4 font-mono text-xs leading-relaxed text-ink-200">
                          {issue.evidence}
                        </pre>
                      </div>
                    )}

                    {issue.suggested_fix?.trim() && (
                      <div className="fix-callout">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="fix-badge">How to fix</span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                            Recommended change
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">
                          {issue.suggested_fix}
                        </p>
                      </div>
                    )}

                    <p className="font-mono text-[10px] text-ink-600">
                      Flagged by {issue.agent_source}
                      {issue.confidence_explanation ? ` · ${issue.confidence_explanation}` : ""}
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
