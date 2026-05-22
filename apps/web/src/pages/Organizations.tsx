import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { useNotification } from "../lib/notification";
import { PasswordRequestsPanel } from "../components/PasswordRequestsPanel";
import type { PasswordChangeRequest } from "../lib/api";
import type { OrganizationRow } from "./PlatformHome";
import type { OrganizationDetails } from "./OrganizationDetails";

const EMPTY_CREATE = {
  name: "",
  github_org: "",
  industry: "Technology",
  plan_tier: "starter",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  address: "",
  admin_name: "",
  admin_email: "",
  admin_password: "admin123",
  admin_github: "",
};

/** AtlasIQ Client Companies analogue — create orgs + Org Admins + edit details. */
export function Organizations() {
  const { notifySuccess, notifyError } = useNotification();
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [passwordRequests, setPasswordRequests] = useState<PasswordChangeRequest[]>([]);
  const [tab, setTab] = useState<"directory" | "onboard">("directory");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrganizationDetails | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    github_org: "",
    industry: "",
    plan_tier: "starter",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    address: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [actingRequest, setActingRequest] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_CREATE);

  function load() {
    apiGet<OrganizationRow[]>("/api/platform/orgs").then(setOrgs).catch(() => setOrgs([]));
    apiGet<PasswordChangeRequest[]>("/api/platform/password-requests")
      .then(setPasswordRequests)
      .catch(() => setPasswordRequests([]));
  }

  function openOrg(id: string) {
    setSelectedId(id);
    setTab("directory");
    apiGet<OrganizationDetails>(`/api/platform/orgs/${id}`)
      .then((o) => {
        setDetail(o);
        setEditForm({
          name: o.name,
          github_org: o.github_org || "",
          industry: o.industry || "",
          plan_tier: o.plan_tier || "starter",
          contact_name: o.contact_name || "",
          contact_email: o.contact_email || "",
          contact_phone: o.contact_phone || "",
          website: o.website || "",
          address: o.address || "",
          is_active: o.is_active,
        });
      })
      .catch((e: Error) => {
        notifyError(e.message);
        setSelectedId(null);
        setDetail(null);
      });
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/platform/orgs", form);
      notifySuccess("Organization and Org Admin created");
      setForm(EMPTY_CREATE);
      setTab("directory");
      load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    try {
      const updated = await apiPatch<OrganizationDetails>(`/api/platform/orgs/${selectedId}`, {
        name: editForm.name,
        github_org: editForm.github_org,
        industry: editForm.industry,
        plan_tier: editForm.plan_tier,
        contact_name: editForm.contact_name,
        contact_email: editForm.contact_email,
        contact_phone: editForm.contact_phone,
        website: editForm.website,
        address: editForm.address,
        is_active: editForm.is_active,
      });
      setDetail(updated);
      setEditForm({
        name: updated.name,
        github_org: updated.github_org || "",
        industry: updated.industry || "",
        plan_tier: updated.plan_tier || "starter",
        contact_name: updated.contact_name || "",
        contact_email: updated.contact_email || "",
        contact_phone: updated.contact_phone || "",
        website: updated.website || "",
        address: updated.address || "",
        is_active: updated.is_active,
      });
      notifySuccess("Organization updated");
      load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save organization");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, isActive: boolean) {
    try {
      await apiPost(`/api/platform/orgs/${id}/status`, { is_active: isActive });
      notifySuccess(
        isActive
          ? "Organization activated — members can sign in again"
          : "Organization deactivated — members can no longer sign in",
      );
      load();
      if (selectedId === id) openOrg(id);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleApprove(id: string) {
    setActingRequest(id);
    try {
      await apiPost(`/api/platform/password-requests/${id}/approve`, {});
      notifySuccess("Org Admin password approved");
      load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActingRequest(null);
    }
  }

  async function handleReject(id: string) {
    setActingRequest(id);
    try {
      await apiPost(`/api/platform/password-requests/${id}/reject`, {});
      notifySuccess("Request rejected");
      load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActingRequest(null);
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="mono-label">Platform operations</p>
        <h3 className="mt-2 text-3xl font-bold text-white">Organizations</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Create organizations, edit company details, and activate/deactivate access. Deactivated
          orgs cannot sign in.
        </p>
      </div>

      {(passwordRequests.length > 0 || actingRequest) && (
        <PasswordRequestsPanel
          requests={passwordRequests}
          loading={false}
          acting={actingRequest}
          onApprove={(id) => void handleApprove(id)}
          onReject={(id) => void handleReject(id)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            closeDetail();
            setTab("directory");
          }}
          className={tab === "directory" && !selectedId ? "btn-tab btn-tab-active" : "btn-tab"}
        >
          Directory ({orgs.length})
        </button>
        <button
          type="button"
          onClick={() => {
            closeDetail();
            setTab("onboard");
          }}
          className={tab === "onboard" ? "btn-tab btn-tab-active" : "btn-tab"}
        >
          Onboard organization
        </button>
      </div>

      {selectedId && detail ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-ghost text-xs" onClick={closeDetail}>
              ← Back to directory
            </button>
            <span className={`tag ${detail.is_active ? "border-white text-white" : ""}`}>
              {detail.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <form onSubmit={(e) => void handleSaveDetail(e)} className="panel space-y-6 p-8">
            <div>
              <p className="mono-label">Organization details</p>
              <p className="mt-2 text-xs text-ink-500">
                Edit company profile. Changes appear on the Org Admin Organization page.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mono-label text-[9px]">Company name</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">GitHub org</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.github_org}
                    onChange={(e) => setEditForm({ ...editForm, github_org: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Industry</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.industry}
                    onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Plan</span>
                  <select
                    className="input-ink mt-2 w-full"
                    value={editForm.plan_tier}
                    onChange={(e) => setEditForm({ ...editForm, plan_tier: e.target.value })}
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-ink-200">
                    Active (unchecked = members cannot sign in)
                  </span>
                </label>
              </div>
            </div>

            <div className="border-t border-ink-800 pt-6">
              <p className="mono-label">Company contact</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mono-label text-[9px]">Contact name</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Contact email</span>
                  <input
                    type="email"
                    className="input-ink mt-2 w-full"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Phone</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.contact_phone}
                    onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Website</span>
                  <input
                    className="input-ink mt-2 w-full"
                    value={editForm.website}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mono-label text-[9px]">Address</span>
                  <textarea
                    className="input-ink mt-2 w-full"
                    rows={2}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-ink" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void toggleStatus(detail.id, !detail.is_active)}
              >
                {detail.is_active ? "Deactivate org" : "Activate org"}
              </button>
            </div>
          </form>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-5">
              <p className="mono-label">Org Admins</p>
              <p className="mt-2 text-3xl font-bold text-white">{detail.admin_count}</p>
            </div>
            <div className="panel p-5">
              <p className="mono-label">Developers</p>
              <p className="mt-2 text-3xl font-bold text-white">{detail.developer_count}</p>
            </div>
            <div className="panel p-5">
              <p className="mono-label">Repos</p>
              <p className="mt-2 text-3xl font-bold text-white">{detail.repo_count}</p>
            </div>
          </div>

          {detail.admins && detail.admins.length > 0 && (
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
                  {detail.admins.map((a) => (
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
        </div>
      ) : tab === "directory" ? (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-800 bg-ink-900">
              <tr>
                <th className="mono-label px-6 py-4">Organization</th>
                <th className="mono-label px-6 py-4">GitHub org</th>
                <th className="mono-label px-6 py-4">Plan</th>
                <th className="mono-label px-6 py-4">Admins</th>
                <th className="mono-label px-6 py-4">Developers</th>
                <th className="mono-label px-6 py-4">Status</th>
                <th className="mono-label px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink-500">
                    No organizations yet — onboard one to get started.
                  </td>
                </tr>
              ) : (
                orgs.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-ink-900 cursor-pointer transition-colors hover:bg-ink-900/60"
                    onClick={() => openOrg(o.id)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{o.name}</p>
                      <p className="text-xs text-ink-500">{o.industry || "—"}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-ink-300">{o.github_org || "—"}</td>
                    <td className="px-6 py-4 capitalize text-ink-300">{o.plan_tier}</td>
                    <td className="px-6 py-4 text-ink-300">{o.admin_count}</td>
                    <td className="px-6 py-4 text-ink-300">{o.developer_count}</td>
                    <td className="px-6 py-4">
                      <span className="tag">{o.is_active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-ghost text-xs" onClick={() => openOrg(o.id)}>
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => void toggleStatus(o.id, !o.is_active)}
                        >
                          {o.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <form onSubmit={(e) => void handleCreate(e)} className="panel space-y-6 p-8">
          <div>
            <p className="mono-label">Organization</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Company name</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">GitHub org (optional)</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.github_org}
                  onChange={(e) => setForm({ ...form, github_org: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Industry</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Plan</span>
                <select
                  className="input-ink mt-2 w-full"
                  value={form.plan_tier}
                  onChange={(e) => setForm({ ...form, plan_tier: e.target.value })}
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
            </div>
          </div>

          <div className="border-t border-ink-800 pt-6">
            <p className="mono-label">Company contact</p>
            <p className="mt-2 text-xs text-ink-500">
              Shown to the Org Admin on their Organization page.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[9px]">Contact name</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Contact email</span>
                <input
                  type="email"
                  className="input-ink mt-2 w-full"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Phone</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Website</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono-label text-[9px]">Address</span>
                <textarea
                  className="input-ink mt-2 w-full"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-ink-800 pt-6">
            <p className="mono-label">Org Admin credentials</p>
            <p className="mt-2 text-xs text-ink-500">
              This person will register repos and manage developers for this company.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[9px]">Admin name</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.admin_name}
                  onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Admin email</span>
                <input
                  type="email"
                  className="input-ink mt-2 w-full"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">Initial password</span>
                <input
                  type="password"
                  className="input-ink mt-2 w-full"
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  required
                  minLength={6}
                />
              </label>
              <label className="block">
                <span className="mono-label text-[9px]">GitHub username (optional)</span>
                <input
                  className="input-ink mt-2 w-full"
                  value={form.admin_github}
                  onChange={(e) => setForm({ ...form, admin_github: e.target.value })}
                />
              </label>
            </div>
          </div>

          <button type="submit" className="btn-ink" disabled={saving}>
            {saving ? "Creating…" : "Create organization + Org Admin"}
          </button>
        </form>
      )}
    </section>
  );
}
