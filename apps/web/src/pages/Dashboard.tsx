import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, type RepoRow } from "../lib/api";
import { fetchStats, type PlatformStats } from "../lib/stats";
import { useCorrectedStats } from "../lib/verdictScore";
import { useAuth } from "../lib/auth";
import { DASHBOARD_METRICS } from "../lib/metricInfos";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../lib/roles";
import { ClickableKpi, InfoHint } from "../components/PanelHelpers";
import PanelInfoModal, { type PanelInfoData } from "../components/PanelInfoModal";

export function Dashboard() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<PanelInfoData | null>(null);
  const shownStats = useCorrectedStats(stats);

  function repoHealth(repo: RepoRow): number | null {
    if (!shownStats) return repo.health_score;
    const rows = shownStats.recent_activity.filter((row) => row.repo === repo.full_name);
    if (rows.length === 0 || rows.length < repo.pr_count) return repo.health_score;
    const nums = rows.map((row) => row.score).filter((score): score is number => score != null);
    if (nums.length === 0) return repo.health_score;
    return Math.round(nums.reduce((sum, score) => sum + score, 0) / nums.length);
  }

  useEffect(() => {
    Promise.all([apiGet<RepoRow[]>("/api/repos"), fetchStats<PlatformStats>()])
      .then(([r, s]) => { setRepos(r); setStats(s); })
      .catch((e: Error) => setError(e.message));
  }, []);

  const isDeveloper = user?.role === "developer";
  const isOrgAdmin = user?.role === "org_admin";

  function showInfo(key: keyof typeof DASHBOARD_METRICS) {
    setInfo(DASHBOARD_METRICS[key]);
  }

  return (
    <section className="space-y-10">
      {error && <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>}

      {user && (isOrgAdmin || isDeveloper) && (
        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mono-label">You are {ROLE_LABELS[user.role]}</p>
              <p className="mt-2 max-w-2xl text-sm text-ink-300">{ROLE_DESCRIPTIONS[user.role]}</p>
            </div>
            {isOrgAdmin && (
              <Link to="/settings" className="btn-ghost shrink-0 text-xs">
                Register repos →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ClickableKpi
          label={isDeveloper ? "Your repos" : "Repositories"}
          value={shownStats?.total_repos ?? stats?.total_repos ?? "—"}
          onInfo={() => showInfo("repos")}
        />
        <ClickableKpi
          label={isDeveloper ? "Your PRs" : "PRs reviewed"}
          value={shownStats?.total_prs ?? stats?.total_prs ?? "—"}
          onInfo={() => showInfo("prs")}
        />
        <ClickableKpi
          label={isDeveloper ? "Your issues" : "Issues found"}
          value={shownStats?.total_issues ?? stats?.total_issues ?? "—"}
          onInfo={() => showInfo("issues")}
        />
        <ClickableKpi
          label="Avg health score"
          value={shownStats?.avg_score ?? stats?.avg_score ?? "—"}
          accent
          onInfo={() => showInfo("health")}
        />
      </div>

      {shownStats && shownStats.recent_activity.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex items-center border-b border-ink-700 px-6 py-4">
            <p className="mono-label flex items-center">
              {isDeveloper ? "Your recent PRs" : "Recent activity"}
              <InfoHint text="Latest reviewed pull requests with health scores. Click a row to open the full report." />
            </p>
            <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => showInfo("activity")}>
              Explain →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left">
                <th className="mono-label px-6 py-3">Repository</th>
                <th className="mono-label px-6 py-3">PR</th>
                <th className="mono-label px-6 py-3">Title</th>
                <th className="mono-label px-6 py-3">Score</th>
                <th className="mono-label px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {shownStats.recent_activity.map((a) => (
                <tr key={a.pr_id} className="table-row">
                  <td className="px-6 py-4 font-mono text-xs text-ink-200">{a.repo}</td>
                  <td className="px-6 py-4">#{a.pr_number}</td>
                  <td className="px-6 py-4">
                    <Link to={`/prs/${a.pr_id}`} className="row-link">{a.title ?? "Untitled"}</Link>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-white">{a.score ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className="tag">{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="mono-label mb-4 flex items-center">
          {isDeveloper ? "Your repositories" : "Repositories"}
          <InfoHint text="Registered GitHub repos with aggregate health scores. Click a card to manage open PRs and trigger reviews." />
        </p>
        {repos.length === 0 && !error && (
          <div className="panel p-8 text-center text-ink-300">
            {isDeveloper
              ? "No PRs from you yet — open a PR on a tracked repo to see it here."
              : "No repos yet — add repositories in Settings"}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Link key={repo.id} to={`/repos/${repo.id}`} className="shortcut-card block">
              <p className="mono-label">Repository</p>
              <p className="mt-2 text-lg font-bold text-white">{repo.full_name}</p>
              <p className="mt-2 text-sm text-ink-400">{repo.pr_count} PR(s) · Health {repoHealth(repo) ?? "—"}</p>
              <div className="mt-4 h-1 bg-ink-800">
                <div className="h-full bg-white transition-all" style={{ width: `${repoHealth(repo) ?? 0}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <PanelInfoModal info={info} onClose={() => setInfo(null)} />
    </section>
  );
}
