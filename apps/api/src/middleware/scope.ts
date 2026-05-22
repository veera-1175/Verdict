import type { Request } from "express";

export type AccessRole = "platform_admin" | "org_admin" | "developer";

export type AccessScope = {
  role: AccessRole;
  userId: string | null;
  githubUsername: string | null;
  orgId: string | null;
};

function normalizeRoleHeader(raw: string | undefined): AccessRole {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "platform_admin" || v === "super_admin") return "platform_admin";
  if (v === "org_admin" || v === "company_admin" || v === "admin") return "org_admin";
  return "developer";
}

export function getAccessScope(req: Request): AccessScope {
  const role = normalizeRoleHeader(req.headers["x-verdict-role"] as string | undefined);
  const userId = (req.headers["x-verdict-user-id"] as string)?.trim() || null;
  const githubUsername = (req.headers["x-verdict-github-username"] as string)?.trim() || null;
  const orgId = (req.headers["x-verdict-org-id"] as string)?.trim() || null;
  return { role, userId, githubUsername, orgId };
}

export function isPlatformAdminScope(scope: AccessScope): boolean {
  return scope.role === "platform_admin";
}

/** Org Admin only — registers repos, manages developers, sees all org PRs. */
export function isOrgAdminScope(scope: AccessScope): boolean {
  return scope.role === "org_admin";
}

/**
 * Users who may touch org/repo/PR data planes.
 * Platform Admin is excluded (AtlasIQ-style isolation).
 */
export function isOrgDataUser(scope: AccessScope): boolean {
  return scope.role === "org_admin" || scope.role === "developer";
}

/** Org-ops admin (repos/team). Platform Admin is NOT included. */
export function isAdminScope(scope: AccessScope): boolean {
  return isOrgAdminScope(scope);
}

/** Org Admin sees all org PRs. Developers see own. Platform Admin sees none. */
export function prVisibleToScope(author: string | null, scope: AccessScope): boolean {
  if (scope.role === "platform_admin") return false;
  if (scope.role === "org_admin") return true;
  if (!scope.githubUsername) return false;
  return (author ?? "").toLowerCase() === scope.githubUsername.toLowerCase();
}
