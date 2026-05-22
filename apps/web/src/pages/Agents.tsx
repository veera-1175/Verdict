import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AGENTS } from "../lib/roles";
import { fetchAgentFindings, fetchStats, type AgentFinding, type PlatformStats } from "../lib/stats";

function severityTag(severity: string | null) {
  if (severity === "critical") return "tag border-white bg-white text-black";
  if (severity === "high") return "tag border-white text-white";
  if (severity === "medium") return "tag border-ink-400";
  return "tag";
}

export function Agents() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats<PlatformStats>().then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!selectedAgent) {
      setFindings([]);
      return;
    }

    setLoadingFindings(true);
    setFindingsError(null);
    fetchAgentFindings(selectedAgent)
      .then(setFindings)
      .catch((e: Error) => {
        setFindings([]);
        setFindingsError(e.message);
      })
      .finally(() => setLoadingFindings(false));
  }, [selectedAgent]);

  function toggleAgent(name: string) {
    setSelectedAgent((prev) => (prev === name ? null : name));
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-4 font-mono text-[10px] uppercase tracking-widest text-ink-300">
        <span className="tag">Webhook</span>
        <span>→</span>
        <span className="tag">Static</span>
        <span>→</span>
        <span className="tag">6 Agents</span>
        <span>→</span>
        <span className="tag border-white bg-white text-black">Master</span>
        <span>→</span>
        <span className="tag">GitHub</span>
      </div>

      <p className="section-desc">Click an agent card to view its findings across all reviewed PRs.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => {
          const count = stats?.issues_by_agent[agent.name] ?? 0;
          const isSelected = selectedAgent === agent.name;

          return (
            <button
              key={agent.name}
              type="button"
              onClick={() => toggleAgent(agent.name)}
              className={`agent-card ${isSelected ? "agent-card-selected" : ""}`}
            >
              <span className="text-2xl">{agent.icon}</span>
              <p className="agent-card-title">{agent.name}</p>
              <p className="agent-card-muted">{agent.focus}</p>
              <p className="agent-card-stat">{count}</p>
              <p className="mono-label mt-1">{count === 1 ? "finding" : "findings"} · click to view</p>
              <p className="agent-card-meta">llama-3.1-8b-instant</p>
            </button>
          );
        })}
      </div>

      {selectedAgent && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700 px-6 py-4">
            <div>
              <p className="mono-label">Agent findings</p>
              <p className="mt-1 text-lg font-bold text-white">{selectedAgent}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setSelectedAgent(null)}>
              Close
            </button>
          </div>

          {loadingFindings && (
            <div className="px-6 py-10 text-center text-ink-400">Loading findings…</div>
          )}

          {findingsError && (
            <div className="border-b border-ink-800 px-6 py-4 text-sm text-ink-200">{findingsError}</div>
          )}

          {!loadingFindings && !findingsError && findings.length === 0 && (
            <div className="px-6 py-10 text-center text-ink-400">
              No findings from {selectedAgent} yet — trigger a review from Settings → Open pull requests.
            </div>
          )}

          {!loadingFindings && findings.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left">
                  <th className="mono-label px-6 py-3">Severity</th>
                  <th className="mono-label px-6 py-3">Finding</th>
                  <th className="mono-label px-6 py-3">Location</th>
                  <th className="mono-label px-6 py-3">PR</th>
                  <th className="mono-label px-6 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id} className="table-row">
                    <td className="px-6 py-4">
                      <span className={severityTag(f.severity)}>{f.severity ?? "low"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{f.title ?? "Untitled"}</p>
                      {f.description && (
                        <p className="mt-1 max-w-md text-xs text-ink-400">{f.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-ink-300">
                      {f.file_path ?? "—"}
                      {f.line_number ? `:${f.line_number}` : ""}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs text-ink-400">{f.repo}</p>
                      <Link to={`/prs/${f.pr_id}`} className="row-link">
                        #{f.pr_number} {f.pr_title ?? "View report"} →
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-white">{f.confidence_score ?? "—"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="panel p-6">
        <p className="mono-label">Master agent</p>
        <p className="section-desc mt-3">
          One Groq call per PR using <span className="font-mono text-white">llama-3.3-70b-versatile</span>.
          Dedupes issues, applies confidence formula, posts GitHub comment + check run.
        </p>
      </div>
    </section>
  );
}
