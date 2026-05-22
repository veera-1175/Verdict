import { Router } from "express";
import { isDbConfigured, listPullRequests, listReposWithHealth } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { getAccessScope, isOrgAdminScope, prVisibleToScope } from "../middleware/scope.js";
import { isGithubAppConfigured } from "../github/client.js";
import { verifyAccessibleRepo } from "../github/accessibleRepos.js";
import { listOpenPullRequests } from "../github/pullRequests.js";
import { enrichPullWithVerdictStatus, triggerReviewForPull } from "../review/triggerReview.js";

export const reposRouter = Router();

reposRouter.get("/", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.json([]);
      return;
    }

    const scope = getAccessScope(req);
    res.json(await listReposWithHealth(scope));
  } catch (err) {
    next(err);
  }
});

reposRouter.post("/", async (req, res, next) => {
  try {
    const scope = getAccessScope(req);
    if (!isOrgAdminScope(scope)) {
      res.status(403).json({ error: "Org Admin access required to register repositories" });
      return;
    }

    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const githubRepoId = Number(req.body?.github_repo_id);
    const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
    const installationId = Number(req.body?.installation_id);

    if (!githubRepoId || !fullName || !installationId) {
      res.status(400).json({
        error: "github_repo_id, full_name, and installation_id are required — pick a repo from GitHub",
      });
      return;
    }

    await verifyAccessibleRepo(githubRepoId, fullName, installationId);

    const repo = localStore.registerRepo({
      githubRepoId,
      fullName,
      installationId,
    });
    const { health_score, pr_count } = localStore.getRepoHealth(repo.id);
    res.status(201).json({ ...repo, health_score, pr_count });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

reposRouter.delete("/:repoId", async (req, res, next) => {
  try {
    const scope = getAccessScope(req);
    if (!isOrgAdminScope(scope)) {
      res.status(403).json({ error: "Org Admin access required to register repositories" });
      return;
    }

    localStore.removeRepo(req.params.repoId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err.message.includes("Cannot remove")) {
        res.status(409).json({ error: err.message });
        return;
      }
    }
    next(err);
  }
});

reposRouter.get("/:repoId/prs", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.json([]);
      return;
    }

    const scope = getAccessScope(req);
    res.json(await listPullRequests(req.params.repoId, scope));
  } catch (err) {
    next(err);
  }
});

reposRouter.get("/:repoId/github/open-prs", async (req, res, next) => {
  try {
    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const repo = localStore.listRepos().find((r) => r.id === req.params.repoId);
    if (!repo) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    if (!repo.installation_id) {
      res.status(400).json({ error: "Repository has no GitHub App installation" });
      return;
    }

    const pulls = await listOpenPullRequests(repo.installation_id, repo.full_name);
    const scope = getAccessScope(req);
    const filtered = isOrgAdminScope(scope)
      ? pulls
      : pulls.filter((p) => prVisibleToScope(p.author, scope));

    res.json({
      full_name: repo.full_name,
      repo_id: repo.id,
      pulls: enrichPullWithVerdictStatus(repo.id, filtered),
    });
  } catch (err) {
    next(err);
  }
});

reposRouter.post("/:repoId/reviews/trigger", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const repo = localStore.listRepos().find((r) => r.id === req.params.repoId);
    if (!repo) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    if (!repo.installation_id) {
      res.status(400).json({ error: "Repository has no GitHub App installation" });
      return;
    }

    const prNumber = Number(req.body?.pr_number);
    const title = typeof req.body?.title === "string" ? req.body.title : "Untitled PR";
    const author = typeof req.body?.author === "string" ? req.body.author : "unknown";
    const headSha = typeof req.body?.head_sha === "string" ? req.body.head_sha : "";

    if (!prNumber) {
      res.status(400).json({ error: "pr_number is required" });
      return;
    }

    const scope = getAccessScope(req);
    if (!isOrgAdminScope(scope) && !prVisibleToScope(author, scope)) {
      res.status(403).json({ error: "You can only trigger reviews for your own pull requests" });
      return;
    }

    const { prId } = await triggerReviewForPull({
      githubRepoId: repo.github_repo_id,
      fullName: repo.full_name,
      installationId: repo.installation_id,
      prNumber,
      title,
      author,
      headSha,
    });

    res.status(202).json({
      accepted: true,
      pr_id: prId,
      message: "Review started",
    });
  } catch (err) {
    next(err);
  }
});
