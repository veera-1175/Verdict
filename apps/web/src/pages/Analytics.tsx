import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStats, type PlatformStats } from "../lib/stats";
import { ANALYTICS_METRICS } from "../lib/metricInfos";
import { ClickableKpi, InfoHint } from "../components/PanelHelpers";
import PanelInfoModal, { type PanelInfoData } from "../components/PanelInfoModal";

function BarChart({ data, onBarHover }: { data: Record<string, number>; onBarHover?: (key: string) => void }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, val]) => (
        <div
          key={key}
          className="group/bar flex cursor-help items-center gap-3"
          title={`${key}: ${val} finding(s)`}
          onMouseEnter={() => onBarHover?.(key)}
        >
          <span className="mono-label w-20 capitalize">{key}</span>
          <div className="h-2 flex-1 bg-ink-800">
            <div className="h-full bg-white transition-all group-hover/bar:bg-white/80" style={{ width: `${(val / max) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-ink-300">{val}</span>
        </div>
      ))}
    </div>
  );
}

export function Analytics() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [info, setInfo] = useState<PanelInfoData | null>(null);

  useEffect(() => {
    fetchStats<PlatformStats>().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return <div className="panel p-8 text-ink-300">Loading analytics…</div>;

  return (
    <section className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ClickableKpi
          label="Avg score"
          value={stats.avg_score ?? "—"}
          className="stat-card border border-ink-700"
          onInfo={() => setInfo(ANALYTICS_METRICS.avg_score)}
        />
        <ClickableKpi
          label="Total issues"
          value={stats.total_issues}
          className="stat-card border border-ink-700"
          onInfo={() => setInfo(ANALYTICS_METRICS.total_issues)}
        />
        <ClickableKpi
          label="PRs"
          value={stats.total_prs}
          className="stat-card border border-ink-700"
          onInfo={() => setInfo(ANALYTICS_METRICS.history)}
        />
        <ClickableKpi
          label="Repos"
          value={stats.total_repos}
          className="stat-card border border-ink-700"
          onInfo={() => setInfo(ANALYTICS_METRICS.avg_score)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <p className="mono-label mb-6 flex items-center">
            Issues by severity
            <InfoHint text="Critical and high severity issues can fail the GitHub Check Run when overall score is below threshold." />
            <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => setInfo(ANALYTICS_METRICS.severity)}>
              Details →
            </button>
          </p>
          <BarChart data={stats.issues_by_severity} />
        </div>
        <div className="panel p-6">
          <p className="mono-label mb-6 flex items-center">
            Findings by agent
            <InfoHint text="Count of issues attributed to each specialist agent after master deduplication." />
            <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => setInfo(ANALYTICS_METRICS.agents)}>
              Details →
            </button>
          </p>
          <BarChart data={stats.issues_by_agent} />
        </div>
      </div>

      <div className="panel p-6">
        <p className="mono-label mb-4 flex items-center">
          Confidence formula
          <InfoHint text="Deterministic score — not raw LLM self-confidence. Static tools and cross-agent agreement increase trust." />
          <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => setInfo(ANALYTICS_METRICS.confidence)}>
            Explain →
          </button>
        </p>
        <code className="block border border-ink-700 bg-black p-4 font-mono text-xs text-ink-200">
          verified = 0.4 × agentSelf + 0.3 × staticAgree + 0.2 × crossAgent + 0.1 × evidenceSpec
        </code>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center border-b border-ink-700 px-6 py-4">
          <p className="mono-label flex items-center">
            Review history
            <InfoHint text="All completed reviews in your scope with links to full agent reports." />
          </p>
          <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => setInfo(ANALYTICS_METRICS.history)}>
            Explain →
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {stats.recent_activity.map((a) => (
              <tr key={a.pr_id} className="table-row">
                <td className="px-6 py-4">{a.repo}</td>
                <td className="px-6 py-4">#{a.pr_number}</td>
                <td className="px-6 py-4 font-mono text-white">{a.score ?? "—"}</td>
                <td className="px-6 py-4"><Link to={`/prs/${a.pr_id}`} className="row-link">View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PanelInfoModal info={info} onClose={() => setInfo(null)} />
    </section>
  );
}
