import { Router, type NextFunction, type Request, type Response } from "express";
import { isDbConfigured } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { getAccessScope, isPlatformAdminScope } from "../middleware/scope.js";

export const platformRouter = Router();

function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isPlatformAdminScope(getAccessScope(req))) {
    res.status(403).json({ error: "Platform Admin access required" });
    return;
  }
  next();
}

platformRouter.use(requirePlatformAdmin);

platformRouter.get("/overview", (_req, res) => {
  if (!isDbConfigured()) {
    res.json({
      organizations: 0,
      active_organizations: 0,
      org_admins: 0,
      developers: 0,
      registered_repos: 0,
      total_reviews: 0,
      total_issues: 0,
      avg_health_score: null,
      organizations_detail: [],
      note: "Database not configured",
    });
    return;
  }
  res.json(localStore.getVerdictUsageOverview());
});

platformRouter.get("/orgs", (_req, res) => {
  if (!isDbConfigured()) {
    res.json([]);
    return;
  }
  res.json(localStore.listOrganizations());
});

platformRouter.get("/orgs/:id", (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }
  const org = localStore.getOrganization(req.params.id);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});

platformRouter.patch("/orgs/:id", (req, res, next) => {
  try {
    const plan =
      req.body?.plan_tier === "professional" || req.body?.plan_tier === "enterprise"
        ? req.body.plan_tier
        : req.body?.plan_tier === "starter"
          ? "starter"
          : undefined;

    const org = localStore.updateOrganization(req.params.id, {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      github_org: typeof req.body?.github_org === "string" ? req.body.github_org : undefined,
      industry: typeof req.body?.industry === "string" ? req.body.industry : undefined,
      plan_tier: plan,
      contact_name: typeof req.body?.contact_name === "string" ? req.body.contact_name : undefined,
      contact_email: typeof req.body?.contact_email === "string" ? req.body.contact_email : undefined,
      contact_phone: typeof req.body?.contact_phone === "string" ? req.body.contact_phone : undefined,
      website: typeof req.body?.website === "string" ? req.body.website : undefined,
      address: typeof req.body?.address === "string" ? req.body.address : undefined,
      is_active: typeof req.body?.is_active === "boolean" ? req.body.is_active : undefined,
    });
    res.json(org);
  } catch (err) {
    if (err instanceof Error) {
      const status = err.message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

platformRouter.post("/orgs", (req, res, next) => {
  try {
    const result = localStore.createOrganizationWithAdmin({
      orgName: typeof req.body?.name === "string" ? req.body.name : "",
      githubOrg: typeof req.body?.github_org === "string" ? req.body.github_org : undefined,
      industry: typeof req.body?.industry === "string" ? req.body.industry : undefined,
      planTier:
        req.body?.plan_tier === "professional" || req.body?.plan_tier === "enterprise"
          ? req.body.plan_tier
          : "starter",
      contactName: typeof req.body?.contact_name === "string" ? req.body.contact_name : undefined,
      contactEmail: typeof req.body?.contact_email === "string" ? req.body.contact_email : undefined,
      contactPhone: typeof req.body?.contact_phone === "string" ? req.body.contact_phone : undefined,
      website: typeof req.body?.website === "string" ? req.body.website : undefined,
      address: typeof req.body?.address === "string" ? req.body.address : undefined,
      adminName: typeof req.body?.admin_name === "string" ? req.body.admin_name : "",
      adminEmail: typeof req.body?.admin_email === "string" ? req.body.admin_email : "",
      adminPassword: typeof req.body?.admin_password === "string" ? req.body.admin_password : "",
      adminGithub: typeof req.body?.admin_github === "string" ? req.body.admin_github : undefined,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error) {
      const status = err.message.includes("already") ? 409 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

platformRouter.post("/orgs/:id/status", (req, res, next) => {
  try {
    const isActive = req.body?.is_active === true;
    const org = localStore.setOrganizationActive(req.params.id, isActive);
    res.json(org);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

platformRouter.get("/password-requests", (_req, res) => {
  res.json(localStore.listPasswordRequests("platform_admin"));
});

platformRouter.post("/password-requests/:id/approve", (req, res, next) => {
  try {
    localStore.approvePasswordRequest(req.params.id);
    res.json({ ok: true, message: "Org Admin password updated" });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

platformRouter.post("/password-requests/:id/reject", (req, res, next) => {
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
