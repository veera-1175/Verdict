import { Router } from "express";
import { isDbConfigured } from "../db/queries.js";
import { localStore } from "../db/localStore.js";
import { getAccessScope, isOrgAdminScope, isPlatformAdminScope } from "../middleware/scope.js";

export const orgRouter = Router();

/** Current organization details — Org Admin only. */
orgRouter.get("/me", (req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const scope = getAccessScope(req);
  if (isPlatformAdminScope(scope)) {
    res.status(403).json({ error: "Platform Admin has no tenant organization — use Organizations" });
    return;
  }
  if (!isOrgAdminScope(scope) || !scope.orgId) {
    res.status(403).json({ error: "Org Admin access required" });
    return;
  }

  const org = localStore.getOrganization(scope.orgId);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});
