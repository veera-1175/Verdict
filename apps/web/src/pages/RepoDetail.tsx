import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {

  apiGet,

  apiPost,

  type OpenPullRow,

  type OpenPullsResponse,

  type PRRow,

  type RepoRow,

} from "../lib/api";

import { useAuth } from "../lib/auth";



export function RepoDetail() {

  const { repoId } = useParams();

  const { user, hasRole } = useAuth();

  const [repo, setRepo] = useState<RepoRow | null>(null);

  const [prs, setPrs] = useState<PRRow[]>([]);

  const [openPulls, setOpenPulls] = useState<OpenPullRow[]>([]);

  const [loadingOpen, setLoadingOpen] = useState(false);

  const [triggering, setTriggering] = useState<number | null>(null);

  const [message, setMessage] = useState<string | null>(null);



  function loadReviewed() {

    if (!repoId) return;

    apiGet<PRRow[]>(`/api/repos/${repoId}/prs`).then(setPrs).catch(() => setPrs([]));

  }



  function loadOpenPulls() {

    if (!repoId) return;

    setLoadingOpen(true);

    apiGet<OpenPullsResponse>(`/api/repos/${repoId}/github/open-prs`)

      .then((data) => setOpenPulls(data.pulls))

      .catch(() => setOpenPulls([]))

      .finally(() => setLoadingOpen(false));

  }



  useEffect(() => {

    if (!repoId) return;

    apiGet<RepoRow[]>("/api/repos")

      .then((repos) => setRepo(repos.find((r) => r.id === repoId) ?? null))

      .catch(() => setRepo(null));

    loadReviewed();

    loadOpenPulls();

  }, [repoId]);



  async function triggerReview(pull: OpenPullRow) {

    if (!repoId) return;

    setTriggering(pull.number);

    setMessage(null);

    try {

      const result = await apiPost<{ pr_id: string; message: string }>(

        `/api/repos/${repoId}/reviews/trigger`,

        {

          pr_number: pull.number,

          title: pull.title,

          author: pull.author,

          head_sha: pull.head_sha,

        },

      );

      setMessage(result.message);

      loadReviewed();

      loadOpenPulls();

    } catch (err) {

      setMessage(err instanceof Error ? err.message : "Failed to trigger review");

    } finally {

      setTriggering(null);

    }

  }



  return (

    <section className="space-y-8">

      <p className="mono-label">

        <Link to="/" className="row-link">← Dashboard</Link>

        {repo && <span className="text-ink-600"> / {repo.full_name}</span>}

      </p>



      {repo && (

        <div className="flex flex-wrap items-center gap-3">

          <span className="tag">{repo.pr_count} reviewed PR(s)</span>

          {repo.health_score != null && <span className="tag border-white/40">Health {repo.health_score}</span>}

          <a

            className="btn-ghost text-xs"

            href={`https://github.com/${repo.full_name}`}

            target="_blank"

            rel="noreferrer"

          >

            Open on GitHub →

          </a>

        </div>

      )}



      {message && (

        <div className="border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{message}</div>

      )}



      <div className="panel overflow-hidden">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-6 py-4">

          <div>

            <p className="mono-label">Open pull requests on GitHub</p>

            <p className="mt-1 text-xs text-ink-400">

              {hasRole("org_admin")

                ? "Trigger Verdict reviews without leaving this page."

                : "Request a review on your open PRs — matched by @"

                  + (user?.github_username ?? "your GitHub username")}

            </p>

          </div>

          <button type="button" className="btn-ghost text-xs" onClick={loadOpenPulls}>

            Refresh

          </button>

        </div>

        {loadingOpen && <p className="px-6 py-8 text-center text-ink-400">Loading open PRs…</p>}

        {!loadingOpen && openPulls.length === 0 && (

          <p className="px-6 py-8 text-center text-ink-400">No open pull requests found for this repo.</p>

        )}

        {!loadingOpen && openPulls.length > 0 && (

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b border-ink-800 text-left">

                <th className="mono-label px-6 py-3">#</th>

                <th className="mono-label px-6 py-3">Title</th>

                <th className="mono-label px-6 py-3">Author</th>

                <th className="mono-label px-6 py-3">Verdict</th>

                <th className="mono-label px-6 py-3"></th>

              </tr>

            </thead>

            <tbody>

              {openPulls.map((pull) => (

                <tr key={pull.number} className="table-row">

                  <td className="px-6 py-4 font-mono text-xs text-ink-300">{pull.number}</td>

                  <td className="px-6 py-4">

                    <a href={pull.html_url} target="_blank" rel="noreferrer" className="row-link">

                      {pull.title}

                    </a>

                  </td>

                  <td className="px-6 py-4 font-mono text-xs text-ink-400">@{pull.author}</td>

                  <td className="px-6 py-4">

                    {pull.has_report && pull.verdict_pr_id ? (

                      <Link to={`/prs/${pull.verdict_pr_id}`} className="row-link">

                        Score {pull.overall_score ?? "—"} · {pull.verdict_status}

                      </Link>

                    ) : pull.verdict_status ? (

                      <span className="tag">{pull.verdict_status}</span>

                    ) : (

                      <span className="text-ink-500">Not reviewed</span>

                    )}

                  </td>

                  <td className="px-6 py-4 text-right">

                    {pull.verdict_pr_id && pull.has_report ? (

                      <Link to={`/prs/${pull.verdict_pr_id}`} className="btn-ghost text-xs">

                        View report

                      </Link>

                    ) : (

                      <button

                        type="button"

                        className="btn-ink text-xs"

                        disabled={triggering === pull.number}

                        onClick={() => void triggerReview(pull)}

                      >

                        {triggering === pull.number ? "Starting…" : "Review in Verdict"}

                      </button>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </div>



      <div className="panel overflow-hidden">

        <div className="border-b border-ink-700 px-6 py-4">

          <p className="mono-label">Reviewed in Verdict</p>

        </div>

        <table className="w-full text-sm">

          <thead>

            <tr className="border-b border-ink-800 text-left">

              <th className="mono-label px-6 py-3">#</th>

              <th className="mono-label px-6 py-3">Title</th>

              <th className="mono-label px-6 py-3">Author</th>

              <th className="mono-label px-6 py-3">Status</th>

            </tr>

          </thead>

          <tbody>

            {prs.length === 0 && (

              <tr>

                <td colSpan={4} className="px-6 py-8 text-center text-ink-400">

                  No pull requests reviewed yet.

                </td>

              </tr>

            )}

            {prs.map((pr) => (

              <tr key={pr.id} className="table-row">

                <td className="px-6 py-4 font-mono text-xs text-ink-300">{pr.pr_number}</td>

                <td className="px-6 py-4">

                  <Link to={`/prs/${pr.id}`} className="row-link">{pr.title ?? "Untitled PR"}</Link>

                </td>

                <td className="px-6 py-4 font-mono text-xs text-ink-400">

                  {pr.author ? `@${pr.author}` : "—"}

                </td>

                <td className="px-6 py-4"><span className="tag">{pr.status}</span></td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </section>

  );

}

