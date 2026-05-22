import { Router } from "express";
import { isDbConfigured } from "../db/queries.js";
import { upsertPullRequest, upsertRepo } from "../db/queries.js";
import { verifyGithubSignature } from "../github/verifyWebhook.js";
import { runReview } from "../orchestrator.js";
import { checkRateLimit } from "../utils/rateLimit.js";

export const webhookRouter = Router();

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    user?: { login?: string };
    head?: { sha?: string };
  };
  repository?: {
    id: number;
    full_name: string;
  };
  installation?: {
    id: number;
  };
}

const REVIEW_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

webhookRouter.post("/", (req, res) => {
  const event = req.headers["x-github-event"] as string | undefined;
  const delivery = req.headers["x-github-delivery"];
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = req.body as Buffer;

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyGithubSignature(rawBody, signature, secret)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  } else {
    console.warn("[webhook] GITHUB_WEBHOOK_SECRET not set — signature check skipped");
  }

  let payload: PullRequestPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as PullRequestPayload;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  console.log("[webhook] received", { event, delivery, action: payload.action });

  if (event === "ping") {
    res.status(200).json({ ok: true, pong: true });
    return;
  }

  if (!isDbConfigured()) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  if (event !== "pull_request" || !payload.action || !REVIEW_ACTIONS.has(payload.action)) {
    res.status(202).json({ accepted: true, skipped: true, reason: "event not handled" });
    return;
  }

  const pr = payload.pull_request;
  const repo = payload.repository;
  const installationId = payload.installation?.id;

  if (!pr || !repo || !installationId) {
    res.status(400).json({ error: "Missing pull_request, repository, or installation" });
    return;
  }

  const rateKey = `install:${installationId}`;
  const limit = checkRateLimit(rateKey, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    res.status(429).json({ error: "Rate limit exceeded", retryAfterSec: limit.retryAfterSec });
    return;
  }

  res.status(202).json({ accepted: true, delivery });

  void (async () => {
    try {
      const repoId = await upsertRepo({
        githubRepoId: repo.id,
        fullName: repo.full_name,
        installationId,
      });

      const prId = await upsertPullRequest({
        repoId,
        prNumber: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        installationId,
        headSha: pr.head?.sha ?? "",
      });

      await runReview(prId);
    } catch (err) {
      console.error("[webhook] async review failed:", (err as Error).message);
    }
  })();
});
