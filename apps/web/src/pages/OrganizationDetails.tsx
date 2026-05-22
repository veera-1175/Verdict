import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export interface OrganizationDetails {
  id: string;
  name: string;
  github_org: string | null;
  industry: string | null;
  plan_tier: string;
  is_active: boolean;
  created_at: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  admin_count: number;
  developer_count: number;
  repo_count: number;
  admins?: Array<{ id: string; name: string; email: string; github_username: string }>;
}

/** Org details collected by Platform Admin at onboarding — read-only for org members. */
export function OrganizationDetailsPage() {
  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<OrganizationDetails>("/api/org/me")
      .then(setOrg)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">{error}</div>
    );
  }

  if (!org) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Organization", org.name],
    ["Status", org.is_active ? "Active" : "Inactive"],
    ["Plan", org.plan_tier],
    ["Industry", org.industry || "—"],
    ["GitHub org", org.github_org ? `@${org.github_org}` : "—"],
    ["Contact name", org.contact_name || "—"],
    ["Contact email", org.contact_email || "—"],
    ["Phone", org.contact_phone || "—"],
    ["Website", org.website || "—"],
    ["Address", org.address || "—"],
    ["Org Admins", String(org.admin_count)],
    ["Developers", String(org.developer_count)],
    ["Registered repos", String(org.repo_count)],
  ];

  return (
    <section className="space-y-8">
      <div>
        <p className="mono-label">Organization</p>
        <h3 className="mt-2 text-3xl font-bold text-white">{org.name}</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Details were set by the Platform Admin when this organization was created.
          Contact Platform Admin to change company profile fields.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-700 px-6 py-4">
          <p className="mono-label">Company profile</p>
        </div>
        <dl className="divide-y divide-ink-900">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-6 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="mono-label text-[9px] sm:pt-1">{label}</dt>
              <dd className="sm:col-span-2 text-sm text-ink-200 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {org.admins && org.admins.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="border-b border-ink-700 px-6 py-4">
            <p className="mono-label">Org Admins</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left">
                <th className="mono-label px-6 py-3">Name</th>
                <th className="mono-label px-6 py-3">Email</th>
                <th className="mono-label px-6 py-3">GitHub</th>
              </tr>
            </thead>
            <tbody>
              {org.admins.map((a) => (
                <tr key={a.id} className="table-row">
                  <td className="px-6 py-4 font-medium text-white">{a.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-300">{a.email}</td>
                  <td className="px-6 py-4 font-mono text-xs text-white">@{a.github_username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
