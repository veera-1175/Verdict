import { Router } from "express";
import { isDbConfigured } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { getAccessScope } from "../middleware/scope.js";

export const statsRouter = Router();

statsRouter.get("/", async (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.json({
        total_repos: 0,
        total_prs: 0,
        total_issues: 0,
        avg_score: null,
        issues_by_severity: {},
        issues_by_agent: {},
        recent_activity: [],
      });
      return;
    }

    const scope = getAccessScope(req);
    res.json(localStore.getPlatformStats(scope));
  } catch (err) {
    next(err);
  }
});

statsRouter.get("/findings", async (req, res, next) => {
  try {
    const agent = typeof req.query.agent === "string" ? req.query.agent.trim() : "";
    if (!agent) {
      res.status(400).json({ error: "agent query parameter is required" });
      return;
    }

    if (!isDbConfigured()) {
      res.json({ agent, findings: [] });
      return;
    }

    const scope = getAccessScope(req);
    res.json({ agent, findings: localStore.getFindingsByAgent(agent, scope) });
  } catch (err) {
    next(err);
  }
});
