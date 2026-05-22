import { Router, type NextFunction, type Request, type Response } from "express";
import { isDbConfigured } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { getAccessScope, isOrgAdminScope, prVisibleToScope } from "../middleware/scope.js";
import { isGithubAppConfigured } from "../github/client.js";
import { listAccessibleRepos, listRepoCollaborators } from "../github/accessibleRepos.js";
import { listOpenPullRequests } from "../github/pullRequests.js";
import { searchGithubUsers } from "../github/userSearch.js";
import { enrichPullWithVerdictStatus, triggerReviewForPull } from "../review/triggerReview.js";
import { runDemoReview } from "../orchestrator.js";

export const adminRouter = Router();

function requireOrgAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isOrgAdminScope(getAccessScope(req))) {
    res.status(403).json({ error: "Org Admin access required — Platform Admin cannot manage client repos or developers" });
    return;
  }
  next();
}

adminRouter.use(requireOrgAdmin);

adminRouter.get("/github/repos", async (_req, res, next) => {
  try {
    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const githubRepos = await listAccessibleRepos();
    const registeredIds = new Set(localStore.listRepos().map((r) => r.github_repo_id));

    res.json(
      githubRepos.map((r) => ({
        ...r,
        registered: registeredIds.has(r.github_repo_id),
      })),
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/github/collaborators", async (req, res, next) => {
  try {
    const installationId = Number(req.query.installation_id);
    const fullName = typeof req.query.full_name === "string" ? req.query.full_name.trim() : "";

    if (!installationId || !fullName) {
      res.status(400).json({ error: "installation_id and full_name are required" });
      return;
    }

    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const repos = await listAccessibleRepos();
    const match = repos.find(
      (r) => r.full_name.toLowerCase() === fullName.toLowerCase() && r.installation_id === installationId,
    );
    if (!match) {
      res.status(404).json({ error: "Repository not found on GitHub App installation" });
      return;
    }

    const collaborators = await listRepoCollaborators(installationId, fullName);
    const existingLogins = new Set(
      localStore.listTeamMembers().map((m) => m.github_username.toLowerCase()),
    );

    res.json({
      full_name: fullName,
      installation_id: installationId,
      github_repo_id: match.github_repo_id,
      collaborators: collaborators.map((c) => ({
        ...c,
        has_login: existingLogins.has(c.login.toLowerCase()),
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/developers", (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.json([]);
      return;
    }
    const scope = getAccessScope(req);
    res.json(localStore.listDevelopers(scope.orgId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/developers", (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const github_username =
      typeof req.body?.github_username === "string" ? req.body.github_username.trim() : "";

    if (!name || !email || !password || !github_username) {
      res.status(400).json({ error: "name, email, password, and github_username are required" });
      return;
    }

    const member = localStore.addTeamMember({
      name,
      email,
      password,
      github_username,
      role: "developer",
      org_id: getAccessScope(req).orgId,
    });
    res.status(201).json({ ...member, default_password: password });
  } catch (err) {
    if (err instanceof Error && err.message.includes("already")) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.post("/developers/from-github", (req, res, next) => {
  try {
    const login = typeof req.body?.login === "string" ? req.body.login.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

    if (!login) {
      res.status(400).json({ error: "login is required" });
      return;
    }

    const member = localStore.addTeamMemberFromGithub({
      login,
      name,
      org_id: getAccessScope(req).orgId,
    });
    res.status(201).json({
      ...member,
      default_password: "dev123",
      email: member.email,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("already")) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.delete("/developers/:id", (req, res, next) => {
  try {
    localStore.removeTeamMember(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.patch("/developers/:id", (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const email = typeof req.body?.email === "string" ? req.body.email : undefined;
    const github_username =
      typeof req.body?.github_username === "string" ? req.body.github_username : undefined;
    const password = typeof req.body?.password === "string" ? req.body.password : undefined;

    const member = localStore.updateTeamMember(req.params.id, {
      name,
      email,
      github_username,
      password: password && password.length > 0 ? password : undefined,
    });
    res.json(member);
  } catch (err) {
    if (err instanceof Error) {
      const status = err.message.includes("not found")
        ? 404
        : err.message.includes("already")
          ? 409
          : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.get("/github/pulls", async (req, res, next) => {
  try {
    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const installationId = Number(req.query.installation_id);
    const fullName = typeof req.query.full_name === "string" ? req.query.full_name.trim() : "";

    if (!installationId || !fullName) {
      res.status(400).json({ error: "installation_id and full_name are required" });
      return;
    }

    const pulls = await listOpenPullRequests(installationId, fullName);
    const registered = localStore.findRepoByFullName(fullName);

    res.json({
      full_name: fullName,
      registered: Boolean(registered),
      repo_id: registered?.id ?? null,
      pulls: enrichPullWithVerdictStatus(registered?.id ?? null, pulls),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/reviews/trigger", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const installationId = Number(req.body?.installation_id);
    const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
    const prNumber = Number(req.body?.pr_number);
    const title = typeof req.body?.title === "string" ? req.body.title : "Untitled PR";
    const author = typeof req.body?.author === "string" ? req.body.author : "unknown";
    const headSha = typeof req.body?.head_sha === "string" ? req.body.head_sha : "";

    if (!installationId || !fullName || !prNumber) {
      res.status(400).json({ error: "installation_id, full_name, and pr_number are required" });
      return;
    }

    const registered = localStore.findRepoByFullName(fullName);
    if (!registered) {
      res.status(400).json({ error: "Register this repository in Verdict before triggering a review" });
      return;
    }

    const scope = getAccessScope(req);
    if (!isOrgAdminScope(scope) && !prVisibleToScope(author, scope)) {
      res.status(403).json({ error: "You can only trigger reviews for your own pull requests" });
      return;
    }

    const { prId, repoId } = await triggerReviewForPull({
      githubRepoId: registered.github_repo_id,
      fullName,
      installationId,
      prNumber,
      title,
      author,
      headSha,
    });

    res.status(202).json({
      accepted: true,
      pr_id: prId,
      repo_id: repoId,
      message: "Review started — refresh in a minute to see results",
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/demo-review", async (_req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const result = await runDemoReview();
    const dashboardUrl = `${process.env.PUBLIC_DASHBOARD_URL ?? "http://localhost:5173"}/prs/${result.prId}`;

    res.json({
      ok: true,
      message: "Demo review complete",
      ...result,
      dashboard_url: dashboardUrl,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/github/users", async (req, res, next) => {
  try {
    if (!isGithubAppConfigured()) {
      res.status(503).json({ error: "GitHub App not configured" });
      return;
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const existing = new Set(
      localStore.listTeamMembers().map((m) => m.github_username.toLowerCase()),
    );
    const users = await searchGithubUsers(q, existing);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/password-requests", (_req, res) => {
  res.json(localStore.listPasswordRequests("org_admin"));
});

adminRouter.post("/password-requests/:id/approve", (req, res, next) => {
  try {
    localStore.approvePasswordRequest(req.params.id);
    res.json({ ok: true, message: "Password updated" });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.post("/password-requests/:id/reject", (req, res, next) => {
  try {
    localStore.rejectPasswordRequest(req.params.id);
    res.json({ ok: true, message: "Request rejected" });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});
