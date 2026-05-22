import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { VerdictUsageOverview } from "./PlatformHome";

/** AtlasIQ Platform Analytics analogue — Verdict usage across tenants. */
export function PlatformUsage() {
  const [overview, setOverview] = useState<VerdictUsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<VerdictUsageOverview>("/api/platform/overview")
      .then(setOverview)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section className="space-y-8">
      {error && (
        <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
      )}

      <div>
        <p className="mono-label">Platform operations</p>
        <h3 className="mt-2 text-3xl font-bold text-white">Usage Analytics</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Cross-tenant Verdict metrics: organizations, admins, developers, and review volume.
          Individual PR reports and repo contents stay with each Org Admin.
        </p>
      </div>

      {overview && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Active orgs", value: overview.active_organizations },
              { label: "Org Admins", value: overview.org_admins },
              { label: "Developers", value: overview.developers },
              { label: "Reviews", value: overview.total_reviews },
              { label: "Issues found", value: overview.total_issues },
              { label: "Repos (all orgs)", value: overview.registered_repos },
              { label: "Avg health", value: overview.avg_health_score ?? "—" },
              { label: "Total orgs", value: overview.organizations },
            ].map((m) => (
              <div key={m.label} className="panel p-6">
                <p className="mono-label">{m.label}</p>
                <p className="mt-4 text-4xl font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
              <p className="mono-label">Per-organization snapshot</p>
              <Link to="/organizations" className="btn-ghost text-xs">
                Manage orgs →
              </Link>
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
                {overview.organizations_detail.map((o) => (
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

          <p className="text-xs text-ink-500">Cross-tenant counts only — not individual PR reports.</p>
        </>
      )}
    </section>
  );
}
