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

export function PRDetail() {
  const { prId } = useParams();
  const { user } = useAuth();
  const [meta, setMeta] = useState<PRMeta | null>(null);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  useEffect(() => {
    if (!prId) return;
    apiGet<PRMeta>(`/api/prs/${prId}`)
      .then(setMeta)
      .catch((e: Error) => setError(e.message));
    apiGet<ReportPayload>(`/api/prs/${prId}/report`)
      .then(setData)
      .catch(() => setData(null));
  }, [prId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.issues.filter((i) => {
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (agentFilter !== "all" && !i.agent_source.includes(agentFilter)) return false;
      return true;
    });
  }, [data, severityFilter, agentFilter]);

  const agents = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const i of data.issues) {
      for (const a of i.agent_source.split(",").map((s) => s.trim())) set.add(a);
    }
    return [...set];
  }, [data]);

  function exportReport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify({ meta, ...data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdict-report-${prId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const score = data?.report.overall_score ?? 0;

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
                <p className="stat-value text-5xl">{data.report.overall_score ?? "—"}</p>
                <p className="mono-label mt-2">Health</p>
              </div>
            </div>
            <div className="flex-1">
              <p className="mono-label">Review summary</p>
              <p className="section-desc mt-3">{data.report.summary ?? "No summary yet."}</p>
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
