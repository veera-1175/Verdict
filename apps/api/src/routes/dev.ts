import { Router } from "express";
import { isDbConfigured } from "../db/queries.js";
import { runDemoReview } from "../orchestrator.js";

export const devRouter = Router();

devRouter.post("/demo-review", async (_req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }
    const result = await runDemoReview();
    res.json({
      ok: true,
      message: "Demo review complete — open the dashboard",
      ...result,
      dashboardUrl: `${process.env.PUBLIC_DASHBOARD_URL ?? "http://localhost:5173"}/prs/${result.prId}`,
    });
  } catch (err) {
    next(err);
  }
});
