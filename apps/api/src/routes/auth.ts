import { Router } from "express";
import { isDbConfigured } from "../db/queries.js";
import { localStore } from "../db/localStore.js";

export const authRouter = Router();

authRouter.post("/login", (req, res, next) => {
  try {
    if (!isDbConfigured()) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const member = localStore.findTeamMemberByEmail(email);
    if (!member || member.password !== password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Deactivated orgs cannot sign in (platform admin has no org_id)
    if (member.role !== "platform_admin" && member.org_id) {
      if (!localStore.isOrganizationActive(member.org_id)) {
        res.status(403).json({
          error: "This organization is deactivated. Contact the Platform Admin.",
        });
        return;
      }
    }

    res.json({
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      org_id: member.org_id,
      github_username: member.role === "platform_admin" ? "" : member.github_username,
      avatar: member.avatar ?? null,
      onboarding_completed: member.onboarding_completed ?? false,
      password_change_pending: member.password_change_pending ?? false,
    });
  } catch (err) {
    next(err);
  }
});
