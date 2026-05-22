import "dotenv/config";
import cors from "cors";
import express from "express";
import { isDbConfigured } from "./db/queries.js";
import { isLocalDbEnabled } from "./db/localStore.js";
import { isGroqConfigured, isGeminiConfigured } from "./agents/llmClient.js";
import { isGithubAppConfigured } from "./github/client.js";
import { reposRouter } from "./routes/repos.js";
import { reviewsRouter } from "./routes/reviews.js";
import { webhookRouter } from "./routes/webhook.js";
import { devRouter } from "./routes/dev.js";
import { statsRouter } from "./routes/stats.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { profileRouter } from "./routes/profile.js";
import { platformRouter } from "./routes/platform.js";
import { orgRouter } from "./routes/org.js";
import { notificationsRouter } from "./routes/notifications.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  allowedHeaders: ["Content-Type", "X-Verdict-User-Id", "X-Verdict-Role", "X-Verdict-Github-Username", "X-Verdict-Org-Id"],
}));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "verdict-api",
    localDb: isLocalDbEnabled(),
    db: isDbConfigured(),
    githubApp: isGithubAppConfigured(),
    llm: {
      groq: isGroqConfigured(),
      gemini: isGeminiConfigured(),
    },
  });
});

app.use("/webhooks/github", express.raw({ type: "application/json" }), webhookRouter);

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/platform", platformRouter);
app.use("/api/org", orgRouter);
app.use("/api/admin", adminRouter);
app.use("/api/profile", profileRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/repos", reposRouter);
app.use("/api", reviewsRouter);
app.use("/api/dev", devRouter);
app.use("/api/stats", statsRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[api]", err.message);
    res.status(500).json({ error: err.message });
  },
);

app.listen(port, () => {
  console.log(`Verdict API listening on http://localhost:${port}`);
});
