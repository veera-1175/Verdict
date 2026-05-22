import { upsertPullRequest, upsertRepo } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { runReview } from "../orchestrator.js";

export interface TriggerReviewParams {
  githubRepoId: number;
  fullName: string;
  installationId: number;
  prNumber: number;
  title: string;
  author: string;
  headSha: string;
}

export async function triggerReviewForPull(
  params: TriggerReviewParams,
): Promise<{ prId: string; repoId: string }> {
  const repoId = await upsertRepo({
    githubRepoId: params.githubRepoId,
    fullName: params.fullName,
    installationId: params.installationId,
  });

  const prId = await upsertPullRequest({
    repoId,
    prNumber: params.prNumber,
    title: params.title,
    author: params.author,
    installationId: params.installationId,
    headSha: params.headSha,
  });

  void runReview(prId).catch((err) => {
    console.error("[triggerReview] async review failed:", (err as Error).message);
  });

  return { prId, repoId };
}

export function enrichPullWithVerdictStatus(
  repoId: string | null,
  pulls: Array<{
    number: number;
    title: string;
    author: string;
    head_sha: string;
    html_url: string;
    updated_at: string;
  }>,
) {
  return pulls.map((pull) => {
    const existing =
      repoId != null ? localStore.findPullRequestByRepoAndNumber(repoId, pull.number) : null;
    const report = existing ? localStore.getLatestReport(existing.id) : null;

    return {
      ...pull,
      verdict_pr_id: existing?.id ?? null,
      verdict_status: existing?.status ?? null,
      has_report: Boolean(report),
      overall_score: report?.report.overall_score ?? null,
    };
  });
}
