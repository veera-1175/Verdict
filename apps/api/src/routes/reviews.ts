import { Router } from "express";
import { getLatestReport, getPullRequestRow, isDbConfigured } from "../db/queries.js";
import { isLocalDbEnabled, localStore } from "../db/localStore.js";
import { getAccessScope, prVisibleToScope } from "../middleware/scope.js";

export const reviewsRouter = Router();

async function assertPrAccess(prId: string, scope: ReturnType<typeof getAccessScope>): Promise<void> {
  if (isLocalDbEnabled()) {
    if (!localStore.canAccessPullRequest(prId, scope)) {
      const err = new Error("FORBIDDEN");
      throw err;
    }
    return;
  }
  const pr = await getPullRequestRow(prId);
  if (!prVisibleToScope(pr.author, scope)) {
    throw new Error("FORBIDDEN");
  }
}

reviewsRouter.get("/prs/:prId", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const scope = getAccessScope(req);
    await assertPrAccess(req.params.prId, scope);

    const pr = await getPullRequestRow(req.params.prId);

    res.json({
      id: pr.id,
      repo_id: pr.repo_id,
      pr_number: pr.pr_number,
      title: pr.title,
      author: pr.author,
      status: pr.status,
      repo_full_name: pr.repo_full_name,
      github_url: `https://github.com/${pr.repo_full_name}/pull/${pr.pr_number}`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      res.status(403).json({ error: "You can only view your own pull request reports" });
      return;
    }
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

reviewsRouter.get("/prs/:prId/report", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const scope = getAccessScope(req);
    await assertPrAccess(req.params.prId, scope);

    const data = await getLatestReport(req.params.prId);

    if (!data) {
      res.status(404).json({ error: "No report for this PR yet" });
      return;
    }

    res.json({ report: data.report, issues: data.issues });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      res.status(403).json({ error: "You can only view your own pull request reports" });
      return;
    }
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});
