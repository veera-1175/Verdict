import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AccessScope } from "../middleware/scope.js";
import { isOrgAdminScope, prVisibleToScope } from "../middleware/scope.js";

export interface LocalOrganization {
  id: string;
  name: string;
  github_org: string | null;
  industry: string | null;
  plan_tier: "starter" | "professional" | "enterprise";
  is_active: boolean;
  created_at: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
}

export interface LocalTeamMember {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "platform_admin" | "org_admin" | "developer";
  org_id: string | null;
  github_username: string;
  created_at: string;
  onboarding_completed?: boolean;
  password_change_pending?: boolean;
}

export type TeamMemberPublic = Omit<LocalTeamMember, "password"> & {
  password_change_pending?: boolean;
};

export interface LocalNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
}

export interface LocalPasswordRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  new_password: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
export interface LocalRepo {
  id: string;
  github_repo_id: number;
  full_name: string;
  installation_id: number | null;
  installed_at: string;
}

export interface LocalPullRequest {
  id: string;
  repo_id: string;
  pr_number: number;
  title: string | null;
  author: string | null;
  status: string;
  installation_id: number | null;
  head_sha: string | null;
  created_at: string;
}

export interface LocalReviewReport {
  id: string;
  pr_id: string;
  summary: string | null;
  overall_score: number | null;
  created_at: string;
}

export interface LocalIssue {
  id: string;
  report_id: string;
  agent_source: string | null;
  file_path: string | null;
  line_number: number | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  evidence: string | null;
  suggested_fix: string | null;
  confidence_score: number | null;
  confidence_explanation: string | null;
}

interface LocalDb {
  organizations: LocalOrganization[];
  repos: LocalRepo[];
  pull_requests: LocalPullRequest[];
  review_reports: LocalReviewReport[];
  issues: LocalIssue[];
  team_members: LocalTeamMember[];
  notifications: LocalNotification[];
  password_requests: LocalPasswordRequest[];
}

const DEMO_ORG_ID = "org-veera";

const DEFAULT_ORGS: LocalOrganization[] = [
  {
    id: DEMO_ORG_ID,
    name: "Veera Corp",
    github_org: "veera-1175",
    industry: "Technology",
    plan_tier: "professional",
    is_active: true,
    created_at: new Date().toISOString(),
    contact_name: "Veera",
    contact_email: "admin@verdict.local",
    contact_phone: "",
    website: "https://github.com/veera-1175",
    address: "",
  },
];

const DEFAULT_TEAM: Omit<LocalTeamMember, "id" | "created_at">[] = [
  {
    email: "platform@verdict.local",
    password: "platform123",
    name: "Skygazer",
    role: "platform_admin",
    org_id: null,
    github_username: "skygazer",
  },
  {
    email: "admin@verdict.local",
    password: "admin123",
    name: "Veera",
    role: "org_admin",
    org_id: DEMO_ORG_ID,
    github_username: "veera-1175",
  },
  {
    email: "developer@verdict.local",
    password: "dev123",
    name: "Demo Developer",
    role: "developer",
    org_id: DEMO_ORG_ID,
    github_username: "demo-dev",
  },
  {
    email: "alice@verdict.local",
    password: "dev123",
    name: "Alice Developer",
    role: "developer",
    org_id: DEMO_ORG_ID,
    github_username: "alice-dev",
  },
];

const DATA_DIR = join(process.cwd(), ".verdict");
const DATA_FILE = join(DATA_DIR, "data.json");

function emptyDb(): LocalDb {
  return {
    organizations: [],
    repos: [],
    pull_requests: [],
    review_reports: [],
    issues: [],
    team_members: [],
    notifications: [],
    password_requests: [],
  };
}

function normalizeMember(m: Partial<LocalTeamMember> & { email: string }): LocalTeamMember {
  let role = m.role as LocalTeamMember["role"] | "admin" | undefined;
  if (role === "admin") role = "org_admin";
  if (role !== "platform_admin" && role !== "org_admin" && role !== "developer") {
    role = "developer";
  }
  return {
    id: m.id ?? randomUUID(),
    email: m.email,
    password: m.password ?? "dev123",
    name: m.name ?? m.email,
    role,
    org_id: m.org_id === undefined ? (role === "platform_admin" ? null : DEMO_ORG_ID) : m.org_id,
    github_username: m.github_username ?? m.email.split("@")[0],
    created_at: m.created_at ?? new Date().toISOString(),
    onboarding_completed: m.onboarding_completed,
    password_change_pending: m.password_change_pending,
  };
}

function normalizeOrganization(o: Partial<LocalOrganization> & { id: string; name: string }): LocalOrganization {
  return {
    id: o.id,
    name: o.name,
    github_org: o.github_org ?? null,
    industry: o.industry ?? null,
    plan_tier: o.plan_tier ?? "starter",
    is_active: o.is_active !== false,
    created_at: o.created_at ?? new Date().toISOString(),
    contact_name: o.contact_name ?? null,
    contact_email: o.contact_email ?? null,
    contact_phone: o.contact_phone ?? null,
    website: o.website ?? null,
    address: o.address ?? null,
  };
}

function seedOrganizations(db: LocalDb): void {
  db.organizations = (db.organizations ?? []).map((o) => normalizeOrganization(o));

  for (const seed of DEFAULT_ORGS) {
    const existing = db.organizations.find((o) => o.id === seed.id);
    if (!existing) {
      db.organizations.push({ ...seed });
    } else {
      existing.name = seed.name;
      existing.github_org = seed.github_org;
      if (!existing.industry) existing.industry = seed.industry;
      if (!existing.plan_tier) existing.plan_tier = seed.plan_tier;
      if (existing.contact_name == null) existing.contact_name = seed.contact_name;
      if (existing.contact_email == null) existing.contact_email = seed.contact_email;
      if (existing.contact_phone == null) existing.contact_phone = seed.contact_phone;
      if (existing.website == null) existing.website = seed.website;
      if (existing.address == null) existing.address = seed.address;
    }
  }

  const seen = new Set<string>();
  db.organizations = db.organizations.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

function seedTeamMembers(db: LocalDb): LocalDb {
  seedOrganizations(db);
  db.team_members = (db.team_members ?? []).map((m) => normalizeMember(m));

  for (const seed of DEFAULT_TEAM) {
    const exists = db.team_members.some((m) => m.email === seed.email);
    if (!exists) {
      db.team_members.push({
        ...seed,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      });
    } else {
      const member = db.team_members.find((m) => m.email === seed.email)!;
      member.role = seed.role;
      member.org_id = seed.org_id;
      member.name = seed.name;
      member.github_username = seed.github_username;
    }
  }

  // Remove duplicate accounts that used veera-1175 as a developer login
  db.team_members = db.team_members.filter((m) => m.email !== "veera-1175@verdict.local");

  // Only Org Admin owns the veera-1175 GitHub username
  for (const m of db.team_members) {
    if (m.email !== "admin@verdict.local" && m.github_username.toLowerCase() === "veera-1175") {
      m.github_username =
        m.email === "developer@verdict.local" ? "demo-dev" : `${m.email.split("@")[0]}-dev`;
    }
  }

  saveDb(db);
  return db;
}
function loadDb(): LocalDb {
  if (!existsSync(DATA_FILE)) {
    return seedTeamMembers(emptyDb());
  }
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<LocalDb>;
    const db: LocalDb = {
      organizations: parsed.organizations ?? [],
      repos: parsed.repos ?? [],
      pull_requests: parsed.pull_requests ?? [],
      review_reports: parsed.review_reports ?? [],
      issues: parsed.issues ?? [],
      team_members: parsed.team_members ?? [],
      notifications: parsed.notifications ?? [],
      password_requests: parsed.password_requests ?? [],
    };
    return seedTeamMembers(db);
  } catch {
    return seedTeamMembers(emptyDb());
  }
}
function saveDb(db: LocalDb): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export function isLocalDbEnabled(): boolean {
  if (process.env.VERDICT_LOCAL_DB === "false") return false;
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key || url.includes("YOUR_PROJECT") || key.startsWith("your_")) {
    return true;
  }
  return process.env.VERDICT_LOCAL_DB === "true";
}

export const localStore = {
  upsertRepo(params: { githubRepoId: number; fullName: string; installationId?: number }): string {
    const db = loadDb();
    const existing = db.repos.find((r) => r.github_repo_id === params.githubRepoId);
    if (existing) {
      if (params.installationId != null) existing.installation_id = params.installationId;
      saveDb(db);
      return existing.id;
    }

    const id = randomUUID();
    db.repos.push({
      id,
      github_repo_id: params.githubRepoId,
      full_name: params.fullName,
      installation_id: params.installationId ?? null,
      installed_at: new Date().toISOString(),
    });
    saveDb(db);
    return id;
  },

  upsertPullRequest(params: {
    repoId: string;
    prNumber: number;
    title: string;
    author: string;
    installationId: number;
    headSha: string;
  }): string {
    const db = loadDb();
    const existing = db.pull_requests.find(
      (p) => p.repo_id === params.repoId && p.pr_number === params.prNumber,
    );

    if (existing) {
      existing.title = params.title;
      existing.author = params.author;
      existing.status = "reviewing";
      existing.installation_id = params.installationId;
      existing.head_sha = params.headSha;
      saveDb(db);
      return existing.id;
    }

    const id = randomUUID();
    db.pull_requests.push({
      id,
      repo_id: params.repoId,
      pr_number: params.prNumber,
      title: params.title,
      author: params.author,
      status: "reviewing",
      installation_id: params.installationId,
      head_sha: params.headSha,
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return id;
  },

  getPullRequest(prId: string): (LocalPullRequest & { repo_full_name: string }) | null {
    const db = loadDb();
    const pr = db.pull_requests.find((p) => p.id === prId);
    if (!pr) return null;
    const repo = db.repos.find((r) => r.id === pr.repo_id);
    return { ...pr, repo_full_name: repo?.full_name ?? "unknown/unknown" };
  },

  setPullRequestStatus(prId: string, status: string): void {
    const db = loadDb();
    const pr = db.pull_requests.find((p) => p.id === prId);
    if (pr) {
      pr.status = status;
      saveDb(db);
    }
  },

  saveReport(
    prId: string,
    report: { summary: string; overallScore: number; issues: Array<{
      agentSources: string[];
      file: string;
      line: number | null;
      severity: string;
      title: string;
      description: string;
      evidence: string;
      suggestedFix: string;
      verifiedConfidence: number;
      confidenceExplanation: string;
    }> },
  ): string {
    const db = loadDb();
    const reportId = randomUUID();
    db.review_reports.push({
      id: reportId,
      pr_id: prId,
      summary: report.summary,
      overall_score: report.overallScore,
      created_at: new Date().toISOString(),
    });

    for (const issue of report.issues) {
      db.issues.push({
        id: randomUUID(),
        report_id: reportId,
        agent_source: issue.agentSources.join(", "),
        file_path: issue.file,
        line_number: issue.line,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        evidence: issue.evidence,
        suggested_fix: issue.suggestedFix,
        confidence_score: issue.verifiedConfidence,
        confidence_explanation: issue.confidenceExplanation,
      });
    }

    const pr = db.pull_requests.find((p) => p.id === prId);
    if (pr) pr.status = "reviewed";

    saveDb(db);
    return reportId;
  },

  listRepos(): LocalRepo[] {
    return [...loadDb().repos].sort(
      (a, b) => new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime(),
    );
  },

  findRepoByFullName(fullName: string): LocalRepo | null {
    const normalized = fullName.trim().toLowerCase();
    return loadDb().repos.find((r) => r.full_name.toLowerCase() === normalized) ?? null;
  },

  findPullRequestByRepoAndNumber(repoId: string, prNumber: number): LocalPullRequest | null {
    return (
      loadDb().pull_requests.find((p) => p.repo_id === repoId && p.pr_number === prNumber) ?? null
    );
  },

  registerRepo(params: {
    githubRepoId: number;
    fullName: string;
    installationId: number;
  }): LocalRepo {
    const db = loadDb();
    const byId = db.repos.find((r) => r.github_repo_id === params.githubRepoId);
    if (byId) {
      byId.full_name = params.fullName;
      byId.installation_id = params.installationId;
      saveDb(db);
      return byId;
    }

    const byName = db.repos.find((r) => r.full_name.toLowerCase() === params.fullName.toLowerCase());
    if (byName) {
      byName.github_repo_id = params.githubRepoId;
      byName.installation_id = params.installationId;
      saveDb(db);
      return byName;
    }

    const repo: LocalRepo = {
      id: randomUUID(),
      github_repo_id: params.githubRepoId,
      full_name: params.fullName,
      installation_id: params.installationId,
      installed_at: new Date().toISOString(),
    };
    db.repos.push(repo);
    saveDb(db);
    return repo;
  },

  removeRepo(repoId: string): void {
    const db = loadDb();
    const idx = db.repos.findIndex((r) => r.id === repoId);
    if (idx === -1) throw new Error("Repository not found");

    const hasPrs = db.pull_requests.some((p) => p.repo_id === repoId);
    if (hasPrs) {
      throw new Error("Cannot remove repository with existing pull requests");
    }

    db.repos.splice(idx, 1);
    saveDb(db);
  },

  listTeamMembers(): TeamMemberPublic[] {
    return loadDb().team_members.map(({ password: _, ...member }) => member);
  },

  listDevelopers(orgId?: string | null): TeamMemberPublic[] {
    return this.listTeamMembers().filter((m) => {
      if (m.role !== "developer") return false;
      if (orgId && m.org_id !== orgId) return false;
      return true;
    });
  },

  listOrganizations() {
    const db = loadDb();
    return db.organizations.map((org) => {
      const members = db.team_members.filter((m) => m.org_id === org.id);
      return {
        ...normalizeOrganization(org),
        admin_count: members.filter((m) => m.role === "org_admin").length,
        developer_count: members.filter((m) => m.role === "developer").length,
        repo_count: db.repos.length,
      };
    });
  },

  getOrganization(orgId: string) {
    const db = loadDb();
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    const members = db.team_members.filter((m) => m.org_id === org.id);
    return {
      ...normalizeOrganization(org),
      admin_count: members.filter((m) => m.role === "org_admin").length,
      developer_count: members.filter((m) => m.role === "developer").length,
      repo_count: db.repos.length,
      admins: members
        .filter((m) => m.role === "org_admin")
        .map(({ password: _, ...m }) => m),
    };
  },

  updateTeamMember(
    id: string,
    updates: {
      name?: string;
      email?: string;
      github_username?: string;
      password?: string;
    },
  ): TeamMemberPublic {
    const db = loadDb();
    const member = db.team_members.find((m) => m.id === id);
    if (!member) throw new Error("Developer not found");
    if (member.role !== "developer") throw new Error("Only developers can be edited here");

    if (updates.email !== undefined) {
      const email = updates.email.trim().toLowerCase();
      if (!email) throw new Error("Email is required");
      if (db.team_members.some((m) => m.id !== id && m.email === email)) {
        throw new Error("Email already registered");
      }
      member.email = email;
    }
    if (updates.github_username !== undefined) {
      const github = updates.github_username.trim();
      if (!github) throw new Error("GitHub username is required");
      if (
        db.team_members.some(
          (m) => m.id !== id && m.github_username.toLowerCase() === github.toLowerCase(),
        )
      ) {
        throw new Error("GitHub username already registered");
      }
      member.github_username = github;
    }
    if (updates.name !== undefined) member.name = updates.name.trim() || member.name;
    if (updates.password !== undefined && updates.password.length >= 6) {
      member.password = updates.password;
    }

    saveDb(db);
    const { password: _, ...pub } = member;
    return pub;
  },

  createOrganizationWithAdmin(params: {
    orgName: string;
    githubOrg?: string;
    industry?: string;
    planTier?: "starter" | "professional" | "enterprise";
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    address?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    adminGithub?: string;
  }) {
    const db = loadDb();
    const name = params.orgName.trim();
    const adminEmail = params.adminEmail.trim().toLowerCase();
    if (!name) throw new Error("Organization name is required");
    if (!adminEmail || !params.adminPassword || !params.adminName.trim()) {
      throw new Error("Org Admin name, email, and password are required");
    }
    if (db.team_members.some((m) => m.email === adminEmail)) {
      throw new Error("Email already registered");
    }

    const org: LocalOrganization = {
      id: randomUUID(),
      name,
      github_org: params.githubOrg?.trim() || null,
      industry: params.industry?.trim() || null,
      plan_tier: params.planTier ?? "starter",
      is_active: true,
      created_at: new Date().toISOString(),
      contact_name: params.contactName?.trim() || params.adminName.trim(),
      contact_email: params.contactEmail?.trim().toLowerCase() || adminEmail,
      contact_phone: params.contactPhone?.trim() || null,
      website: params.website?.trim() || null,
      address: params.address?.trim() || null,
    };
    db.organizations.push(org);

    const github = (params.adminGithub?.trim() || adminEmail.split("@")[0]).replace(/[^a-zA-Z0-9-_]/g, "");
    if (db.team_members.some((m) => m.github_username.toLowerCase() === github.toLowerCase())) {
      throw new Error("GitHub username already registered");
    }

    const admin: LocalTeamMember = {
      id: randomUUID(),
      email: adminEmail,
      password: params.adminPassword,
      name: params.adminName.trim(),
      role: "org_admin",
      org_id: org.id,
      github_username: github,
      created_at: new Date().toISOString(),
      onboarding_completed: false,
      password_change_pending: false,
    };
    db.team_members.push(admin);
    saveDb(db);

    const { password: _, ...adminPublic } = admin;
    return { organization: org, admin: adminPublic };
  },

  setOrganizationActive(orgId: string, isActive: boolean): LocalOrganization {
    const db = loadDb();
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");
    org.is_active = isActive;
    saveDb(db);
    return normalizeOrganization(org);
  },

  updateOrganization(
    orgId: string,
    updates: {
      name?: string;
      github_org?: string | null;
      industry?: string | null;
      plan_tier?: "starter" | "professional" | "enterprise";
      contact_name?: string | null;
      contact_email?: string | null;
      contact_phone?: string | null;
      website?: string | null;
      address?: string | null;
      is_active?: boolean;
    },
  ) {
    const db = loadDb();
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) throw new Error("Organization name is required");
      org.name = name;
    }
    if (updates.github_org !== undefined) org.github_org = updates.github_org?.trim() || null;
    if (updates.industry !== undefined) org.industry = updates.industry?.trim() || null;
    if (updates.plan_tier !== undefined) org.plan_tier = updates.plan_tier;
    if (updates.contact_name !== undefined) org.contact_name = updates.contact_name?.trim() || null;
    if (updates.contact_email !== undefined) {
      org.contact_email = updates.contact_email?.trim().toLowerCase() || null;
    }
    if (updates.contact_phone !== undefined) org.contact_phone = updates.contact_phone?.trim() || null;
    if (updates.website !== undefined) org.website = updates.website?.trim() || null;
    if (updates.address !== undefined) org.address = updates.address?.trim() || null;
    if (updates.is_active !== undefined) org.is_active = updates.is_active;

    saveDb(db);
    return this.getOrganization(orgId)!;
  },

  isOrganizationActive(orgId: string | null): boolean {
    if (!orgId) return true; // platform admin has no org
    const org = loadDb().organizations.find((o) => o.id === orgId);
    if (!org) return false;
    return org.is_active !== false;
  },

  getVerdictUsageOverview() {
    const db = loadDb();
    const orgs = db.organizations;
    const admins = db.team_members.filter((m) => m.role === "org_admin");
    const developers = db.team_members.filter((m) => m.role === "developer");
    const reviews = db.review_reports.length;
    const issues = db.issues.length;
    const scores = db.review_reports
      .map((r) => r.overall_score)
      .filter((s): s is number => s != null);

    return {
      organizations: orgs.length,
      active_organizations: orgs.filter((o) => o.is_active).length,
      org_admins: admins.length,
      developers: developers.length,
      registered_repos: db.repos.length,
      total_reviews: reviews,
      total_issues: issues,
      avg_health_score:
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      organizations_detail: this.listOrganizations(),
      note: "Aggregate platform metrics only.",
    };
  },

  findTeamMemberByEmail(email: string): LocalTeamMember | null {
    const normalized = email.trim().toLowerCase();
    return loadDb().team_members.find((m) => m.email === normalized) ?? null;
  },

  findTeamMemberByGithubUsername(username: string): LocalTeamMember | null {
    const normalized = username.trim().toLowerCase();
    return (
      loadDb().team_members.find((m) => m.github_username.toLowerCase() === normalized) ?? null
    );
  },

  addTeamMemberFromGithub(params: {
    login: string;
    name?: string;
    password?: string;
    org_id?: string | null;
  }): TeamMemberPublic {
    const login = params.login.trim();
    const existing = this.findTeamMemberByGithubUsername(login);
    if (existing) {
      const { password: _, ...pub } = existing;
      return pub;
    }

    return this.addTeamMember({
      name: params.name?.trim() || login,
      email: `${login.toLowerCase()}@verdict.local`,
      password: params.password ?? "dev123",
      github_username: login,
      org_id: params.org_id,
    });
  },

  addTeamMember(params: {
    name: string;
    email: string;
    password: string;
    github_username: string;
    role?: "org_admin" | "developer";
    org_id?: string | null;
  }): TeamMemberPublic {
    const db = loadDb();
    const email = params.email.trim().toLowerCase();
    const github_username = params.github_username.trim();
    const role = params.role ?? "developer";

    if (db.team_members.some((m) => m.email === email)) {
      throw new Error("Email already registered");
    }
    if (db.team_members.some((m) => m.github_username.toLowerCase() === github_username.toLowerCase())) {
      throw new Error("GitHub username already registered");
    }

    const member: LocalTeamMember = {
      id: randomUUID(),
      email,
      password: params.password,
      name: params.name.trim(),
      role,
      org_id: params.org_id === undefined ? DEMO_ORG_ID : params.org_id,
      github_username,
      created_at: new Date().toISOString(),
      onboarding_completed: false,
      password_change_pending: false,
    };
    db.team_members.push(member);
    saveDb(db);

    const { password: _, ...pub } = member;
    return pub;
  },

  removeTeamMember(id: string): void {
    const db = loadDb();
    const idx = db.team_members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Developer not found");
    db.team_members.splice(idx, 1);
    saveDb(db);
  },

  listPullRequests(repoId: string, scope?: AccessScope): LocalPullRequest[] {
    return loadDb()
      .pull_requests.filter((p) => {
        if (p.repo_id !== repoId) return false;
        if (!scope || isOrgAdminScope(scope)) return true;
        return prVisibleToScope(p.author, scope);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  listReposWithHealth(scope?: AccessScope) {
    const db = loadDb();
    // Platform Admin must not see tenant repo inventory
    if (scope?.role === "platform_admin") return [];

    return this.listRepos()
      .map((repo) => {
        let prs = db.pull_requests.filter((p) => p.repo_id === repo.id);
        if (scope?.role === "developer") {
          prs = prs.filter((p) => prVisibleToScope(p.author, scope));
          if (prs.length === 0) return null;
        }

        const scores: number[] = [];
        for (const pr of prs) {
          const latest = db.review_reports
            .filter((r) => r.pr_id === pr.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (latest?.overall_score != null) scores.push(latest.overall_score);
        }

        return {
          ...repo,
          health_score:
            scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          pr_count: prs.length,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  },

  canAccessPullRequest(prId: string, scope: AccessScope): boolean {
    const pr = loadDb().pull_requests.find((p) => p.id === prId);
    if (!pr) return false;
    return prVisibleToScope(pr.author, scope);
  },
  getLatestReport(prId: string): { report: LocalReviewReport; issues: LocalIssue[] } | null {
    const db = loadDb();
    const reports = db.review_reports
      .filter((r) => r.pr_id === prId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const report = reports[0];
    if (!report) return null;

    const issues = db.issues
      .filter((i) => i.report_id === report.id)
      .sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));

    return { report, issues };
  },

  getRepoHealth(repoId: string): { health_score: number | null; pr_count: number } {
    const db = loadDb();
    const prs = db.pull_requests.filter((p) => p.repo_id === repoId);
    if (prs.length === 0) return { health_score: null, pr_count: 0 };

    const scores: number[] = [];
    for (const pr of prs) {
      const latest = db.review_reports
        .filter((r) => r.pr_id === pr.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (latest?.overall_score !== null && latest?.overall_score !== undefined) {
        scores.push(latest.overall_score);
      }
    }

    return {
      health_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      pr_count: prs.length,
    };
  },

  getPlatformStats(scope?: AccessScope) {
    const db = loadDb();
    // Platform Admin uses getVerdictUsageOverview — not tenant PR analytics
    if (scope?.role === "platform_admin") {
      return {
        total_repos: 0,
        total_prs: 0,
        total_issues: 0,
        avg_score: null,
        issues_by_severity: {},
        issues_by_agent: {},
        recent_activity: [],
      };
    }

    const visiblePrs = db.pull_requests.filter(
      (pr) => !scope || isOrgAdminScope(scope) || prVisibleToScope(pr.author, scope),
    );
    const visiblePrIds = new Set(visiblePrs.map((p) => p.id));

    const visibleReportIds = new Set(
      db.review_reports.filter((r) => visiblePrIds.has(r.pr_id)).map((r) => r.id),
    );

    const scores: number[] = [];
    const severity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const agents: Record<string, number> = {};

    for (const pr of visiblePrs) {
      const latest = db.review_reports
        .filter((r) => r.pr_id === pr.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (latest?.overall_score != null) scores.push(latest.overall_score);
    }

    for (const issue of db.issues) {
      if (!visibleReportIds.has(issue.report_id)) continue;
      const sev = issue.severity ?? "low";
      severity[sev] = (severity[sev] ?? 0) + 1;
      for (const name of (issue.agent_source ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
        agents[name] = (agents[name] ?? 0) + 1;
      }
    }

    const visibleRepoIds = new Set(visiblePrs.map((p) => p.repo_id));

    const recent = visiblePrs
      .map((pr) => {
        const repo = db.repos.find((r) => r.id === pr.repo_id);
        const report = db.review_reports
          .filter((r) => r.pr_id === pr.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          pr_id: pr.id,
          pr_number: pr.pr_number,
          title: pr.title,
          repo: repo?.full_name ?? "unknown",
          status: pr.status,
          score: report?.overall_score ?? null,
          reviewed_at: report?.created_at ?? pr.created_at,
        };
      })
      .sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())
      .slice(0, 8);

    return {
      total_repos: scope?.role === "developer" ? visibleRepoIds.size : db.repos.length,
      total_prs: visiblePrs.length,
      total_issues: db.issues.filter((i) => visibleReportIds.has(i.report_id)).length,
      avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      issues_by_severity: severity,
      issues_by_agent: agents,
      recent_activity: recent,
    };
  },

  getFindingsByAgent(agentName: string, scope?: AccessScope) {
    const db = loadDb();
    const findings: Array<
      LocalIssue & {
        pr_id: string;
        pr_number: number;
        pr_title: string | null;
        repo: string;
      }
    > = [];

    for (const issue of db.issues) {
      const sources = (issue.agent_source ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!sources.includes(agentName)) continue;

      const report = db.review_reports.find((r) => r.id === issue.report_id);
      if (!report) continue;
      const pr = db.pull_requests.find((p) => p.id === report.pr_id);
      if (!pr) continue;
      if (scope && scope.role === "developer" && !prVisibleToScope(pr.author, scope)) continue;
      const repo = db.repos.find((r) => r.id === pr.repo_id);
      findings.push({
        ...issue,
        pr_id: pr.id,
        pr_number: pr.pr_number,
        pr_title: pr.title,
        repo: repo?.full_name ?? "unknown",
      });
    }

    return findings.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
  },

  findTeamMemberById(id: string): LocalTeamMember | null {
    return loadDb().team_members.find((m) => m.id === id) ?? null;
  },

  getTeamMemberPublic(id: string): TeamMemberPublic | null {
    const member = this.findTeamMemberById(id);
    if (!member) return null;
    const { password: _, ...pub } = member;
    return {
      ...pub,
      password_change_pending: member.password_change_pending ?? false,
      onboarding_completed: member.onboarding_completed ?? false,
    };
  },

  updateTeamMemberProfile(
    id: string,
    updates: { name?: string; complete_onboarding?: boolean },
  ): TeamMemberPublic {
    const db = loadDb();
    const member = db.team_members.find((m) => m.id === id);
    if (!member) throw new Error("User not found");
    if (updates.name !== undefined) member.name = updates.name.trim();
    if (updates.complete_onboarding) member.onboarding_completed = true;
    saveDb(db);
    return this.getTeamMemberPublic(id)!;
  },

  setMemberPassword(id: string, newPassword: string): void {
    const db = loadDb();
    const member = db.team_members.find((m) => m.id === id);
    if (!member) throw new Error("User not found");
    member.password = newPassword;
    member.password_change_pending = false;
    saveDb(db);
  },

  createNotification(params: {
    userId: string | null;
    title: string;
    message: string;
    linkPath?: string;
  }): LocalNotification {
    const db = loadDb();
    const note: LocalNotification = {
      id: randomUUID(),
      user_id: params.userId,
      title: params.title,
      message: params.message,
      link_path: params.linkPath ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(note);
    if (db.notifications.length > 100) db.notifications.length = 100;
    saveDb(db);
    return note;
  },

  listNotifications(scope: AccessScope): LocalNotification[] {
    const db = loadDb();
    const isOperator = scope.role === "platform_admin" || scope.role === "org_admin";
    return db.notifications.filter((n) => {
      if (isOperator) return n.user_id === null || n.user_id === scope.userId;
      return n.user_id === scope.userId;
    });
  },

  notificationSummary(scope: AccessScope): { unread_count: number } {
    const unread = this.listNotifications(scope).filter((n) => !n.is_read).length;
    return { unread_count: unread };
  },

  markNotificationRead(id: string, scope: AccessScope): void {
    const db = loadDb();
    const note = db.notifications.find((n) => n.id === id);
    if (!note) throw new Error("Notification not found");
    const isOperator = scope.role === "platform_admin" || scope.role === "org_admin";
    const allowed = isOperator
      ? note.user_id === null || note.user_id === scope.userId
      : note.user_id === scope.userId;
    if (!allowed) throw new Error("Notification not found");
    note.is_read = true;
    saveDb(db);
  },

  markAllNotificationsRead(scope: AccessScope): void {
    const db = loadDb();
    const isOperator = scope.role === "platform_admin" || scope.role === "org_admin";
    for (const note of db.notifications) {
      const allowed = isOperator
        ? note.user_id === null || note.user_id === scope.userId
        : note.user_id === scope.userId;
      if (allowed) note.is_read = true;
    }
    saveDb(db);
  },

  createPasswordRequest(params: {
    userId: string;
    newPassword: string;
  }): LocalPasswordRequest {
    const db = loadDb();
    const member = db.team_members.find((m) => m.id === params.userId);
    if (!member) throw new Error("User not found");
    if (member.password_change_pending) {
      throw new Error("You already have a pending password change request");
    }

    const pending = db.password_requests.find(
      (r) => r.user_id === params.userId && r.status === "pending",
    );
    if (pending) throw new Error("You already have a pending password change request");

    const req: LocalPasswordRequest = {
      id: randomUUID(),
      user_id: member.id,
      user_email: member.email,
      user_name: member.name,
      new_password: params.newPassword,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    db.password_requests.unshift(req);
    member.password_change_pending = true;
    saveDb(db);

    this.createNotification({
      userId: null,
      title: "Password change request",
      message: `${member.name} (${member.role}) requested a password change`,
      linkPath: member.role === "org_admin" ? "/organizations" : "/team",
    });

    return req;
  },

  listPasswordRequests(forRole?: "platform_admin" | "org_admin"): LocalPasswordRequest[] {
    const db = loadDb();
    return db.password_requests
      .filter((r) => {
        if (r.status !== "pending") return false;
        if (!forRole) return true;
        const member = db.team_members.find((m) => m.id === r.user_id);
        if (!member) return false;
        if (forRole === "platform_admin") return member.role === "org_admin";
        return member.role === "developer";
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  approvePasswordRequest(id: string): void {
    const db = loadDb();
    const req = db.password_requests.find((r) => r.id === id);
    if (!req || req.status !== "pending") throw new Error("Request not found");

    const member = db.team_members.find((m) => m.id === req.user_id);
    if (!member) throw new Error("User not found");

    member.password = req.new_password;
    member.password_change_pending = false;
    req.status = "approved";

    this.createNotification({
      userId: member.id,
      title: "Password updated",
      message: "Your password change was approved by an admin",
      linkPath: "/profile",
    });

    saveDb(db);
  },

  rejectPasswordRequest(id: string): void {
    const db = loadDb();
    const req = db.password_requests.find((r) => r.id === id);
    if (!req || req.status !== "pending") throw new Error("Request not found");

    const member = db.team_members.find((m) => m.id === req.user_id);
    if (member) member.password_change_pending = false;
    req.status = "rejected";

    if (member) {
      this.createNotification({
        userId: member.id,
        title: "Password request declined",
        message: "Your password change request was rejected — contact your admin",
        linkPath: "/profile",
      });
    }

    saveDb(db);
  },
};
