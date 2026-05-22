import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

export interface VerdictUsageOverview {
  organizations: number;
  active_organizations: number;
  org_admins: number;
  developers: number;
  registered_repos: number;
  total_reviews: number;
  total_issues: number;
  avg_health_score: number | null;
  organizations_detail: OrganizationRow[];
  note: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  github_org: string | null;
  industry: string | null;
  plan_tier: string;
  is_active: boolean;
  created_at: string;
  admin_count: number;
  developer_count: number;
  repo_count: number;
}

/** AtlasIQ Command Center analogue — platform ops only, no client PR data. */
export function PlatformHome() {
  const [overview, setOverview] = useState<VerdictUsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<VerdictUsageOverview>("/api/platform/overview")
      .then(setOverview)
      .catch((e: Error) => setError(e.message));
  }, []);

  const metrics = overview
    ? [
        { label: "Organizations", value: overview.organizations, sub: `${overview.active_organizations} active` },
        { label: "Org Admins", value: overview.org_admins, sub: "Portal managers" },
        { label: "Developers", value: overview.developers, sub: "Across all orgs" },
        { label: "Repos registered", value: overview.registered_repos, sub: "By Org Admins" },
        { label: "Reviews run", value: overview.total_reviews, sub: "Platform total" },
        { label: "Avg health", value: overview.avg_health_score ?? "—", sub: "Aggregate score" },
      ]
    : [];

  const workflow = [
    { n: "01", t: "Onboard org", d: "Create company + Org Admin" },
    { n: "02", t: "Org connects GitHub", d: "Org Admin registers repos" },
    { n: "03", t: "Team reviews", d: "Developers open PRs" },
    { n: "04", t: "Monitor usage", d: "You track Verdict metrics only" },
  ];

  return (
    <section className="space-y-10">
      {error && (
        <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono-label">Verdict Platform</p>
          <h3 className="mt-2 text-3xl font-bold text-white">Command Center</h3>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">
            Operate the multi-tenant PR intelligence platform. Onboard organizations, assign Org Admins,
            and monitor usage — without accessing client repositories or PR contents.
          </p>
        </div>
        <Link to="/organizations" className="btn-ink shrink-0">
          Onboard organization
        </Link>
      </div>

      <div className="grid gap-px bg-ink-800 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((m, i) => (
          <div key={m.label} className="stat-card bg-ink-950 p-6" style={{ animationDelay: `${i * 0.06}s` }}>
            <p className="mono-label">{m.label}</p>
            <p className="mt-4 text-4xl font-bold text-white">{m.value}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="panel p-8">
        <p className="mono-label">Client lifecycle</p>
        <h3 className="mt-2 text-2xl font-bold text-white">Standard onboarding workflow</h3>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((s) => (
            <div key={s.n} className="border border-ink-800 bg-black p-5">
              <p className="font-mono text-xs text-ink-400">{s.n}</p>
              <p className="mt-2 font-semibold text-white">{s.t}</p>
              <p className="mt-1 text-xs text-ink-400">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-ink-500">
          Client PR contents stay with each Org Admin.
        </p>
      </div>

      {overview && overview.organizations_detail.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="border-b border-ink-700 px-6 py-4">
            <p className="mono-label">Recent organizations</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-ink-800 bg-ink-900">
              <tr>
                <th className="mono-label px-6 py-3 text-left">Organization</th>
                <th className="mono-label px-6 py-3 text-left">Plan</th>
                <th className="mono-label px-6 py-3 text-left">Admins</th>
                <th className="mono-label px-6 py-3 text-left">Developers</th>
                <th className="mono-label px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.organizations_detail.slice(0, 6).map((o) => (
                <tr key={o.id} className="border-b border-ink-900">
                  <td className="px-6 py-4 font-medium text-white">{o.name}</td>
                  <td className="px-6 py-4 capitalize text-ink-300">{o.plan_tier}</td>
                  <td className="px-6 py-4 text-ink-300">{o.admin_count}</td>
                  <td className="px-6 py-4 text-ink-300">{o.developer_count}</td>
                  <td className="px-6 py-4">
                    <span className="tag">{o.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
