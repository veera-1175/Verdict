import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type GitHubUserResult,
  type PasswordChangeRequest,
  type TeamMemberRow,
} from "../lib/api";
import { DEMO_ORG, ROLE_DESCRIPTIONS, ROLE_LABELS, roleBadgeClass } from "../lib/roles";
import { useNotification } from "../lib/notification";
import { GitHubUserSearch } from "../components/GitHubUserSearch";
import { PasswordRequestsPanel } from "../components/PasswordRequestsPanel";
import { InfoHint } from "../components/PanelHelpers";

const EMPTY_FORM = { name: "", email: "", password: "dev123", github_username: "" };

export function Team() {
  const { user } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [developers, setDevelopers] = useState<TeamMemberRow[]>([]);
  const [passwordRequests, setPasswordRequests] = useState<PasswordChangeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedGithub, setSelectedGithub] = useState<GitHubUserResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actingRequest, setActingRequest] = useState<string | null>(null);

  function loadDevelopers() {
    apiGet<TeamMemberRow[]>("/api/admin/developers")
      .then(setDevelopers)
      .catch((e: Error) => setError(e.message));
  }

  function loadPasswordRequests() {
    setLoadingRequests(true);
    apiGet<PasswordChangeRequest[]>("/api/admin/password-requests")
      .then(setPasswordRequests)
      .catch(() => setPasswordRequests([]))
      .finally(() => setLoadingRequests(false));
  }

  useEffect(() => {
    loadDevelopers();
    loadPasswordRequests();
  }, []);

  function handleGithubSelect(ghUser: GitHubUserResult) {
    setSelectedGithub(ghUser);
    setForm((prev) => ({
      ...prev,
      github_username: ghUser.login,
      name: ghUser.name?.trim() || ghUser.login,
      email: ghUser.email?.trim() || `${ghUser.login.toLowerCase()}@verdict.local`,
    }));
  }

  function startEdit(d: TeamMemberRow) {
    setEditingId(d.id);
    setSelectedGithub(null);
    setForm({
      name: d.name,
      email: d.email,
      password: "",
      github_username: d.github_username,
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setSelectedGithub(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiPatch(`/api/admin/developers/${editingId}`, {
          name: form.name,
          email: form.email,
          github_username: form.github_username,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
        notifySuccess(`Updated ${form.name}`);
        cancelEdit();
      } else {
        await apiPost("/api/admin/developers", form);
        notifySuccess(`Developer ${form.name || form.github_username} added`);
        setForm(EMPTY_FORM);
        setSelectedGithub(null);
      }
      loadDevelopers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save developer";
      setError(msg);
      notifyError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove developer ${name}?`)) return;
    try {
      await apiDelete(`/api/admin/developers/${id}`);
      if (editingId === id) cancelEdit();
      loadDevelopers();
      notifySuccess(`Removed ${name}`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to remove developer");
    }
  }

  async function handleApproveRequest(id: string) {
    setActingRequest(id);
    try {
      await apiPost(`/api/admin/password-requests/${id}/approve`, {});
      loadPasswordRequests();
      notifySuccess("Password change approved");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActingRequest(null);
    }
  }

  async function handleRejectRequest(id: string) {
    setActingRequest(id);
    try {
      await apiPost(`/api/admin/password-requests/${id}/reject`, {});
      loadPasswordRequests();
      notifySuccess("Password request rejected");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActingRequest(null);
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="mono-label">Administration</p>
        <h3 className="mt-2 text-3xl font-bold text-white">Team & access</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Manage developers for <span className="text-white">{DEMO_ORG.name}</span>. They only see
          PRs authored by their linked GitHub username.
        </p>
      </div>

      <div className="panel p-6">
        <p className="mono-label">Current session</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center bg-white font-mono text-lg font-bold text-black">
            {user?.name.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{user?.name}</p>
            <p className={user ? roleBadgeClass(user.role) : "role-badge"}>
              {user ? ROLE_LABELS[user.role] : ""} · {DEMO_ORG.name}
            </p>
          </div>
        </div>
      </div>

      {(loadingRequests || passwordRequests.length > 0) && (
        <PasswordRequestsPanel
          requests={passwordRequests}
          loading={loadingRequests}
          acting={actingRequest}
          onApprove={(id) => void handleApproveRequest(id)}
          onReject={(id) => void handleRejectRequest(id)}
        />
      )}

      <div className="panel p-6">
        <p className="mono-label flex items-center">
          {editingId ? "Edit developer" : "Add developer"}
          <InfoHint text="Search GitHub, click a user to autofill name and email." />
        </p>

        {selectedGithub && !editingId && (
          <div className="mt-4 flex items-center gap-3 border border-ink-700 bg-ink-950 p-3">
            <img src={selectedGithub.avatar_url} alt="" className="h-10 w-10 border border-ink-600" />
            <div>
              <p className="font-medium text-white">{selectedGithub.name ?? selectedGithub.login}</p>
              <p className="font-mono text-xs text-ink-400">@{selectedGithub.login}</p>
              {selectedGithub.email && (
                <p className="text-[10px] text-ink-500">{selectedGithub.email}</p>
              )}
            </div>
            <a
              href={selectedGithub.html_url}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost ml-auto text-xs"
            >
              GitHub →
            </a>
          </div>
        )}

        {error && (
          <div className="mt-4 border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {editingId ? (
              <>
                <label className="mono-label mb-2 block">GitHub username</label>
                <input
                  className="input-ink"
                  value={form.github_username}
                  onChange={(e) => setForm({ ...form, github_username: e.target.value })}
                  required
                />
              </>
            ) : (
              <GitHubUserSearch
                value={form.github_username}
                onChange={(v) => setForm({ ...form, github_username: v })}
                onSelect={handleGithubSelect}
              />
            )}
          </div>
          <div>
            <label className="mono-label mb-2 block">Name</label>
            <input
              className="input-ink"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mono-label mb-2 block">Email</label>
            <input
              type="email"
              className="input-ink"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mono-label mb-2 block">
              {editingId ? "New password (optional)" : "Initial password"}
            </label>
            <input
              type="password"
              className="input-ink"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
              minLength={editingId ? undefined : 6}
              placeholder={editingId ? "Leave blank to keep current" : undefined}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
            <button type="submit" className="btn-ink" disabled={saving || !form.github_username}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add developer"}
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink-700 px-6 py-4">
          <p className="mono-label">Developers ({developers.length})</p>
          <p className="mt-1 text-xs text-ink-500">{ROLE_DESCRIPTIONS.developer}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left">
              <th className="mono-label px-6 py-3">Name</th>
              <th className="mono-label px-6 py-3">Email</th>
              <th className="mono-label px-6 py-3">GitHub</th>
              <th className="mono-label px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {developers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-ink-500">
                  No developers yet — add one above.
                </td>
              </tr>
            ) : (
              developers.map((d) => (
                <tr key={d.id} className="table-row">
                  <td className="px-6 py-4 font-medium text-white">{d.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-ink-300">{d.email}</td>
                  <td className="px-6 py-4 font-mono text-xs text-white">@{d.github_username}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(d)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => void handleRemove(d.id, d.name)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
