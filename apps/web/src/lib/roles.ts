export type Role = "platform_admin" | "org_admin" | "developer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  org_id?: string | null;
  github_username?: string;
  avatar?: string;
  onboarding_completed?: boolean;
  password_change_pending?: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  org_admin: "Org Admin",
  developer: "Developer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  platform_admin: "You create organizations and follow how Verdict is being used.",
  org_admin: "You manage this company's repositories, its team, and the reviews on their pull requests.",
  developer: "You see the review reports for the pull requests you opened.",
};

export const DEMO_ORG = {
  id: "org-veera",
  name: "Veera Corp",
  github_org: "veera-1175",
} as const;

export const canAccessSettings = (role: Role) => role === "org_admin";
export const canManageTeam = (role: Role) => role === "org_admin";
export const canAccessPlatformOps = (role: Role) => role === "platform_admin";
export const canAccessOrgWorkspace = (role: Role) => role === "org_admin" || role === "developer";
export const canExport = canAccessOrgWorkspace;

export function isPathAllowed(role: Role, pathname: string): boolean {
  const base = "/" + (pathname.split("/")[1] || "");
  if (base === "/login" || base === "/profile") return true;
  if (role === "platform_admin") {
    return ["/", "/organizations", "/platform-usage", "/profile"].includes(base);
  }
  if (role === "org_admin") {
    return ["/", "/analytics", "/agents", "/team", "/settings", "/repos", "/prs", "/profile", "/organization"].includes(base);
  }
  return ["/", "/analytics", "/agents", "/repos", "/prs", "/profile"].includes(base);
}

export function normalizeRole(role: string): Role {
  if (role === "platform_admin" || role === "super_admin") return "platform_admin";
  if (role === "org_admin" || role === "company_admin" || role === "admin") return "org_admin";
  return "developer";
}

export function roleBadgeClass(role: Role): string {
  if (role === "platform_admin") return "role-badge role-badge-super";
  if (role === "org_admin") return "role-badge role-badge-admin";
  return "role-badge role-badge-employee";
}

export const PLATFORM_ADMIN_USER = {
  id: "platform-admin",
  email: "platform@verdict.local",
  password: "platform123",
  name: "Skygazer",
  role: "platform_admin" as const,
  org_id: null as string | null,
};

export const ORG_ADMIN_USER = {
  id: "org-admin",
  email: "admin@verdict.local",
  password: "admin123",
  name: "Veera",
  role: "org_admin" as const,
  org_id: DEMO_ORG.id,
  github_username: "veera-1175",
};

export const SEED_DEVELOPERS = [
  {
    email: "developer@verdict.local",
    password: "dev123",
    name: "Demo Developer",
    github: "demo-dev",
    org_id: DEMO_ORG.id,
  },
];

export const AGENTS = [
  { name: "Inspection", icon: "🔎", focus: "Any file, any language. Broken syntax, bad structure, and small defects" },
  { name: "Security", icon: "🛡️", focus: "Secrets, injection, and unsafe access" },
  { name: "Code Quality", icon: "✨", focus: "Broken structure, dead code, and defects hidden by complexity" },
  { name: "Performance", icon: "⚡", focus: "Slow queries, blocking work, and wasted memory" },
  { name: "Architecture", icon: "🏗️", focus: "Modules that depend on each other in a way that will break" },
  { name: "Documentation", icon: "📄", focus: "Docs that describe behavior the code does not have" },
  { name: "Best Practices", icon: "✅", focus: "Error handling that hides failures" },
];
