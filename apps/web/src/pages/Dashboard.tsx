import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, type RepoRow } from "../lib/api";
import { fetchStats, type PlatformStats } from "../lib/stats";
import { useAuth } from "../lib/auth";
import { DASHBOARD_METRICS } from "../lib/metricInfos";
import { HIERARCHY, ROLE_LABELS } from "../lib/roles";
import { ClickableKpi, InfoHint } from "../components/PanelHelpers";
import PanelInfoModal, { type PanelInfoData } from "../components/PanelInfoModal";

export function Dashboard() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<PanelInfoData | null>(null);

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

      {isOrgAdmin && (
        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mono-label">You are {user ? ROLE_LABELS[user.role] : "Org Admin"}</p>
              <p className="mt-2 max-w-2xl text-sm text-ink-300">{HIERARCHY.summary}</p>
              <p className="mt-2 text-xs text-ink-500">
                Flow: Register repos in Settings → developers open PRs → you see all org reviews. Platform Admin
                does not manage repos.
              </p>
            </div>
            <Link to="/settings" className="btn-ghost shrink-0 text-xs">
              Register repos →
            </Link>
          </div>
        </div>
      )}

      {isDeveloper && user?.github_username && (
        <div className="panel p-4">
          <p className="mono-label flex items-center">
            Your scope
            <InfoHint text="Developers only see PRs where the GitHub author matches your linked username." />
          </p>
          <p className="mt-2 text-sm text-ink-200">
            Showing PRs authored by <span className="font-mono text-white">@{user.github_username}</span> only.
            Creating a GitHub repo does not make you Org Admin — that role is assigned separately.
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ClickableKpi
          label={isDeveloper ? "Your repos" : "Repositories"}
          value={stats?.total_repos ?? "—"}
          onInfo={() => showInfo("repos")}
        />
        <ClickableKpi
          label={isDeveloper ? "Your PRs" : "PRs reviewed"}
          value={stats?.total_prs ?? "—"}
          onInfo={() => showInfo("prs")}
        />
        <ClickableKpi
          label={isDeveloper ? "Your issues" : "Issues found"}
          value={stats?.total_issues ?? "—"}
          onInfo={() => showInfo("issues")}
        />
        <ClickableKpi
          label="Avg health score"
          value={stats?.avg_score ?? "—"}
          accent
          onInfo={() => showInfo("health")}
        />
      </div>

      {stats && stats.recent_activity.length > 0 && (
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
              {stats.recent_activity.map((a) => (
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
              <p className="mt-2 text-sm text-ink-400">{repo.pr_count} PR(s) · Health {repo.health_score ?? "—"}</p>
              <div className="mt-4 h-1 bg-ink-800">
                <div className="h-full bg-white transition-all" style={{ width: `${repo.health_score ?? 0}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <PanelInfoModal info={info} onClose={() => setInfo(null)} />
    </section>
  );
}
