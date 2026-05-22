import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAuthConfigured, supabase } from "../lib/supabase";
import {
  apiDelete,
  apiGet,
  apiPost,
  type CollaboratorsResponse,
  type DemoReviewResponse,
  type DeveloperFromGithubResponse,
  type GitHubRepoOption,
  type OpenPullsResponse,
  type PlatformHealth,
  type RepoRow,
  type TriggerReviewResponse,
} from "../lib/api";
import type { User } from "@supabase/supabase-js";

import { getApiBase } from "../lib/apiBase";

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

function statusDot(ok: boolean) {
  return ok ? "text-white" : "text-ink-500";
}

export function Settings() {
  const appSlug = import.meta.env.VITE_GITHUB_APP_SLUG ?? "your-verdict-app";
  const [user, setUser] = useState<User | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubRepoOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [collaborators, setCollaborators] = useState<CollaboratorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(true);
  const [loadingCollab, setLoadingCollab] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [addingLogin, setAddingLogin] = useState<string | null>(null);
  const [createdLogins, setCreatedLogins] = useState<Record<string, { email: string; password: string }>>({});
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [openPulls, setOpenPulls] = useState<OpenPullsResponse | null>(null);
  const [loadingPulls, setLoadingPulls] = useState(false);
  const [triggeringPr, setTriggeringPr] = useState<number | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoPrId, setDemoPrId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLogin, setCopiedLogin] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function loadRegisteredRepos() {
    apiGet<RepoRow[]>("/api/repos").then(setRepos).catch(() => setRepos([]));
  }

  function loadGithubRepos() {
    setLoadingGithub(true);
    setError(null);
    apiGet<GitHubRepoOption[]>("/api/admin/github/repos")
      .then((list) => {
        setGithubRepos(list);
        if (list.length > 0 && !selectedKey) {
          setSelectedKey(`${list[0].installation_id}:${list[0].full_name}`);
        }
      })
      .catch((e: Error) => {
        setGithubRepos([]);
        setError(e.message);
      })
      .finally(() => setLoadingGithub(false));
  }

  function loadHealth() {
    fetch(`${getApiBase()}/health`)
      .then((r) => r.json())
      .then((data) => setHealth(data as PlatformHealth))
      .catch(() => setHealth(null));
  }

  function loadOpenPulls() {
    if (!selectedRepo || !selectedRepo.app_has_access) {
      setOpenPulls(null);
      return;
    }

    setLoadingPulls(true);
    apiGet<OpenPullsResponse>(
      `/api/admin/github/pulls?installation_id=${selectedRepo.installation_id}&full_name=${encodeURIComponent(selectedRepo.full_name)}`,
    )
      .then(setOpenPulls)
      .catch(() => setOpenPulls(null))
      .finally(() => setLoadingPulls(false));
  }

  useEffect(() => {
    loadRegisteredRepos();
    loadGithubRepos();
    loadHealth();
  }, []);

  const selectedRepo = githubRepos.find(
    (r) => `${r.installation_id}:${r.full_name}` === selectedKey,
  );

  useEffect(() => {
    if (!selectedRepo || !selectedRepo.app_has_access) {
      setCollaborators(null);
      return;
    }

    setLoadingCollab(true);
    setError(null);
    apiGet<CollaboratorsResponse>(
      `/api/admin/github/collaborators?installation_id=${selectedRepo.installation_id}&full_name=${encodeURIComponent(selectedRepo.full_name)}`,
    )
      .then(setCollaborators)
      .catch((e: Error) => {
        setCollaborators(null);
        setError(e.message);
      })
      .finally(() => setLoadingCollab(false));
  }, [selectedRepo?.installation_id, selectedRepo?.full_name, selectedRepo?.app_has_access]);

  useEffect(() => {
    loadOpenPulls();
  }, [selectedRepo?.installation_id, selectedRepo?.full_name, selectedRepo?.app_has_access, selectedRepo?.registered]);

  async function triggerReview(pull: {
    number: number;
    title: string;
    author: string;
    head_sha: string;
  }) {
    if (!selectedRepo) return;
    setTriggeringPr(pull.number);
    setError(null);
    try {
      await apiPost<TriggerReviewResponse>("/api/admin/reviews/trigger", {
        installation_id: selectedRepo.installation_id,
        full_name: selectedRepo.full_name,
        pr_number: pull.number,
        title: pull.title,
        author: pull.author,
        head_sha: pull.head_sha,
      });
      loadOpenPulls();
      loadRegisteredRepos();
      setSuccessMessage("Review started — refresh in a minute to see results.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger review");
    } finally {
      setTriggeringPr(null);
    }
  }

  async function runDemoReview() {
    setDemoRunning(true);
    setDemoPrId(null);
    setError(null);
    try {
      const result = await apiPost<DemoReviewResponse>("/api/admin/demo-review", {});
      setDemoPrId(result.prId);
      loadRegisteredRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo review failed");
    } finally {
      setDemoRunning(false);
    }
  }

  function copyLogin(login: string) {
    const creds = createdLogins[login];
    if (!creds) return;
    copyText(`${creds.email} / ${creds.password}`);
    setCopiedLogin(login);
    setTimeout(() => setCopiedLogin(null), 2000);
  }

  async function registerRepo() {
    if (!selectedRepo) return;
    setRegistering(true);
    setError(null);
    try {
      await apiPost("/api/repos", {
        github_repo_id: selectedRepo.github_repo_id,
        full_name: selectedRepo.full_name,
        installation_id: selectedRepo.installation_id,
      });
      loadRegisteredRepos();
      loadGithubRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register repository");
    } finally {
      setRegistering(false);
    }
  }

  async function addDeveloperLogin(login: string, name: string) {
    setAddingLogin(login);
    setError(null);
    try {
      const result = await apiPost<DeveloperFromGithubResponse>("/api/admin/developers/from-github", {
        login,
        name,
      });
      setCreatedLogins((prev) => ({
        ...prev,
        [login]: { email: result.email, password: result.default_password },
      }));
      if (collaborators) {
        setCollaborators({
          ...collaborators,
          collaborators: collaborators.collaborators.map((c) =>
            c.login === login ? { ...c, has_login: true } : c,
          ),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create developer login");
    } finally {
      setAddingLogin(null);
    }
  }

  async function removeRepo(id: string, name: string) {
    if (!confirm(`Remove ${name} from Verdict? (Only if it has no PRs yet)`)) return;
    try {
      await apiDelete(`/api/repos/${id}`);
      loadRegisteredRepos();
      loadGithubRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove repository");
    }
  }

  async function signInWithGitHub() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono-label">Platform status</p>
            <p className="section-desc mt-3">
              Run reviews, manage repos, and onboard developers without switching to GitHub.
            </p>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={loadHealth}>
            Refresh status
          </button>
        </div>

        {health && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-ink-700 p-3">
              <p className="mono-label">API</p>
              <p className={`mt-2 font-mono text-sm ${statusDot(health.ok)}`}>{health.ok ? "● Online" : "○ Offline"}</p>
            </div>
            <div className="border border-ink-700 p-3">
              <p className="mono-label">Database</p>
              <p className={`mt-2 font-mono text-sm ${statusDot(health.db)}`}>{health.db ? "● Ready" : "○ Not configured"}</p>
            </div>
            <div className="border border-ink-700 p-3">
              <p className="mono-label">GitHub App</p>
              <p className={`mt-2 font-mono text-sm ${statusDot(health.githubApp)}`}>{health.githubApp ? "● Connected" : "○ Missing keys"}</p>
            </div>
            <div className="border border-ink-700 p-3">
              <p className="mono-label">Groq LLM</p>
              <p className={`mt-2 font-mono text-sm ${statusDot(health.llm.groq)}`}>{health.llm.groq ? "● Ready" : "○ Missing key"}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ink" disabled={demoRunning} onClick={() => void runDemoReview()}>
            {demoRunning ? "Running demo…" : "Run demo review"}
          </button>
          {demoPrId && (
            <Link to={`/prs/${demoPrId}`} className="btn-ghost text-xs">
              Open demo report →
            </Link>
          )}
          <span className="text-xs text-ink-500">Sample PR with security & performance findings — no GitHub needed.</span>
        </div>
        {successMessage && (
          <div className="mt-4 border border-white/30 bg-white/5 px-4 py-3 text-sm text-ink-100">{successMessage}</div>
        )}
      </div>

      <div className="panel p-6">
        <p className="mono-label">GitHub repositories</p>
        <p className="section-desc mt-3">
          All repositories on your GitHub account are listed below. You can only register repos where the
          Verdict GitHub App is installed — others show “needs app access”.
        </p>

        {loadingGithub ? (
          <p className="mt-6 text-sm text-ink-400">Loading repositories from GitHub…</p>
        ) : githubRepos.length === 0 ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-ink-400">No repositories found on your GitHub App installation.</p>
            <a
              className="btn-ink inline-flex"
              href={`https://github.com/apps/${appSlug}/installations/new`}
              target="_blank"
              rel="noreferrer"
            >
              Install GitHub App on a repo
            </a>
            <button type="button" className="btn-ghost ml-3" onClick={loadGithubRepos}>
              Refresh list
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[280px] flex-1">
                <label className="mono-label mb-2 block">Repository</label>
                <select
                  className="input-ink"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                  {githubRepos.map((r) => (
                    <option key={`${r.installation_id}:${r.full_name}`} value={`${r.installation_id}:${r.full_name}`}>
                      {r.full_name}
                      {r.registered ? " ✓ registered" : ""}
                      {r.app_has_access ? "" : " — needs app access"}
                      {r.private ? " (private)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-ink"
                disabled={registering || !selectedRepo || selectedRepo.registered || !selectedRepo.app_has_access}
                onClick={() => void registerRepo()}
              >
                {selectedRepo?.registered
                  ? "Already registered"
                  : !selectedRepo?.app_has_access
                    ? "Grant app access first"
                    : registering
                      ? "Registering…"
                      : "Register repository"}
              </button>
              {!selectedRepo?.app_has_access && selectedRepo && (
                <a
                  className="btn-ghost inline-flex"
                  href={`https://github.com/apps/${appSlug}/installations/new`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add app to repo →
                </a>
              )}
              <button type="button" className="btn-ghost" onClick={loadGithubRepos}>
                Refresh
              </button>
            </div>

            {selectedRepo?.description && (
              <p className="text-xs text-ink-400">{selectedRepo.description}</p>
            )}

            {selectedRepo?.app_has_access && (
              <div className="overflow-hidden border border-ink-700">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
                  <div>
                    <p className="mono-label">Open pull requests</p>
                    <p className="mt-1 text-xs text-ink-400">
                      Trigger Verdict reviews from here — results appear on Dashboard and Agents.
                    </p>
                  </div>
                  <button type="button" className="btn-ghost text-xs" onClick={loadOpenPulls}>
                    Refresh PRs
                  </button>
                </div>
                {!selectedRepo.registered && (
                  <p className="px-4 py-6 text-sm text-ink-400">
                    Register this repository first to enable in-app reviews.
                  </p>
                )}
                {selectedRepo.registered && loadingPulls && (
                  <p className="px-4 py-6 text-sm text-ink-400">Loading open pull requests…</p>
                )}
                {selectedRepo.registered && !loadingPulls && openPulls && openPulls.pulls.length === 0 && (
                  <p className="px-4 py-6 text-sm text-ink-400">No open pull requests on this repository.</p>
                )}
                {selectedRepo.registered && !loadingPulls && openPulls && openPulls.pulls.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-800 text-left">
                        <th className="mono-label px-4 py-3">#</th>
                        <th className="mono-label px-4 py-3">Title</th>
                        <th className="mono-label px-4 py-3">Author</th>
                        <th className="mono-label px-4 py-3">Verdict</th>
                        <th className="mono-label px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPulls.pulls.map((pull) => (
                        <tr key={pull.number} className="table-row">
                          <td className="px-4 py-3 font-mono text-xs">{pull.number}</td>
                          <td className="px-4 py-3">
                            <a href={pull.html_url} target="_blank" rel="noreferrer" className="row-link">
                              {pull.title}
                            </a>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-400">@{pull.author}</td>
                          <td className="px-4 py-3">
                            {pull.has_report && pull.verdict_pr_id ? (
                              <Link to={`/prs/${pull.verdict_pr_id}`} className="row-link">
                                Score {pull.overall_score ?? "—"}
                              </Link>
                            ) : pull.verdict_status ? (
                              <span className="tag">{pull.verdict_status}</span>
                            ) : (
                              <span className="text-ink-500">Not reviewed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pull.verdict_pr_id && pull.has_report ? (
                              <Link to={`/prs/${pull.verdict_pr_id}`} className="btn-ghost text-xs">
                                View report
                              </Link>
                            ) : (
                              <button
                                type="button"
                                className="btn-ink text-xs"
                                disabled={triggeringPr === pull.number}
                                onClick={() => void triggerReview(pull)}
                              >
                                {triggeringPr === pull.number ? "Starting…" : "Review in Verdict"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div>
              <p className="mono-label mb-3">Collaborators — click to create developer login</p>
              {selectedRepo && !selectedRepo.app_has_access && (
                <p className="mb-3 text-sm text-ink-400">
                  Grant the Verdict GitHub App access to this repo to load collaborators and enable PR reviews.
                </p>
              )}
              {loadingCollab && <p className="text-sm text-ink-400">Loading collaborators…</p>}
              {!loadingCollab && collaborators && collaborators.collaborators.length === 0 && (
                <p className="text-sm text-ink-400">No collaborators found for this repository.</p>
              )}
              {!loadingCollab && collaborators && collaborators.collaborators.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {collaborators.collaborators.map((c) => (
                    <div key={c.login} className="feature-card flex items-center gap-3">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-10 w-10 border border-ink-600" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center bg-ink-800 font-mono text-sm">
                          {c.login.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{c.name}</p>
                        <p className="font-mono text-xs text-ink-400">@{c.login}</p>
                        {createdLogins[c.login] && (
                          <div className="mt-1 flex items-center gap-2">
                            <p className="font-mono text-[10px] text-ink-300">
                              {createdLogins[c.login].email} / {createdLogins[c.login].password}
                            </p>
                            <button
                              type="button"
                              className="font-mono text-[10px] text-ink-400 underline"
                              onClick={() => copyLogin(c.login)}
                            >
                              {copiedLogin === c.login ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                      {c.has_login || createdLogins[c.login] ? (
                        <span className="tag border-white/40">Has login</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost shrink-0 text-xs"
                          disabled={addingLogin === c.login}
                          onClick={() => void addDeveloperLogin(c.login, c.name)}
                        >
                          {addingLogin === c.login ? "…" : "Add login"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-ink-500">
                Default password is <span className="font-mono">dev123</span>. Email is{" "}
                <span className="font-mono">username@verdict.local</span>. Developers only see PRs they authored on GitHub.
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 border border-white/30 bg-white/5 px-4 py-3 text-sm text-ink-100">{successMessage}</div>
        )}

        {error && (
          <div className="mt-4 border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
        )}

        <div className="mt-8 overflow-hidden border border-ink-700">
          <div className="border-b border-ink-800 px-4 py-3">
            <p className="mono-label">Registered in Verdict</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left">
                <th className="mono-label px-4 py-3">Repository</th>
                <th className="mono-label px-4 py-3">PRs</th>
                <th className="mono-label px-4 py-3">Health</th>
                <th className="mono-label px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {repos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-400">No repositories registered yet</td>
                </tr>
              )}
              {repos.map((repo) => (
                <tr key={repo.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-white">
                    <Link to={`/repos/${repo.id}`} className="row-link">{repo.full_name}</Link>
                  </td>
                  <td className="px-4 py-3">{repo.pr_count}</td>
                  <td className="px-4 py-3 font-mono">{repo.health_score ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => void removeRepo(repo.id, repo.full_name)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel p-6">
        <p className="mono-label">GitHub App</p>
        <p className="section-desc mt-3">
          Repositories must be granted to the Verdict GitHub App before they appear in the dropdown above.
        </p>
        <a
          className="btn-ink mt-6 inline-flex"
          href={`https://github.com/apps/${appSlug}/installations/new`}
          target="_blank"
          rel="noreferrer"
        >
          Manage GitHub App installations
        </a>
      </div>

      <div className="panel p-6">
        <p className="mono-label">Account (Supabase)</p>
        {!isAuthConfigured && (
          <p className="section-desc mt-3">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.</p>
        )}
        {isAuthConfigured && !user && (
          <>
            <p className="section-desc mt-3">Optional Supabase GitHub OAuth.</p>
            <button type="button" className="btn-ink mt-6" onClick={signInWithGitHub}>
              Sign in with GitHub
            </button>
          </>
        )}
        {user && (
          <>
            <p className="section-desc mt-3">
              Signed in as {user.email ?? user.user_metadata?.user_name ?? user.id}
            </p>
            <button type="button" className="btn-ghost mt-6" onClick={signOut}>
              Sign out
            </button>
          </>
        )}
      </div>

      <div className="panel p-6">
        <p className="mono-label">Auto-fail threshold</p>
        <p className="section-desc mt-3">
          PRs scoring below this overall health score fail the GitHub Check Run (default 60).
        </p>
        <code className="mt-4 block border border-ink-700 bg-black px-4 py-3 font-mono text-xs text-ink-200">
          AUTO_FAIL_SCORE_THRESHOLD=60
        </code>
      </div>
    </section>
  );
}
