import { Link, Outlet, useLocation, useParams, Navigate } from "react-router-dom";
import { useEffect, useState, type ReactElement } from "react";
import { useAuth } from "../lib/auth";
import {
  ROLE_LABELS,
  canAccessOrgWorkspace,
  canAccessPlatformOps,
  canAccessSettings,
  canManageTeam,
  isPathAllowed,
  roleBadgeClass,
  type Role,
} from "../lib/roles";
import { githubAvatarUrl } from "../lib/githubAvatar";
import { VerdictLogo, IconGrid, IconChart, IconAgents, IconShield, IconSettings } from "./Icons";
import { NotificationBell } from "./NotificationBell";
import { OnboardingTour } from "./OnboardingTour";
import { apiGet, type PRMeta, type RepoRow } from "../lib/api";
import { fetchStats, type PlatformStats } from "../lib/stats";

type NavItem = {
  path: string;
  label: string;
  Icon: () => ReactElement;
};

function navForRole(role: Role): { title: string; items: NavItem[]; admin?: boolean }[] {
  if (role === "platform_admin") {
    return [
      {
        title: "Platform Operations",
        admin: true,
        items: [
          { path: "/", label: "Command Center", Icon: IconGrid },
          { path: "/organizations", label: "Organizations", Icon: IconShield },
          { path: "/platform-usage", label: "Usage Analytics", Icon: IconChart },
        ],
      },
    ];
  }

  const workspace: { title: string; items: NavItem[]; admin?: boolean } = {
    title: "Workspace",
    items: [
      { path: "/", label: "Dashboard", Icon: IconGrid },
      { path: "/analytics", label: "Analytics", Icon: IconChart },
      { path: "/agents", label: "Agents", Icon: IconAgents },
    ],
  };

  if (role === "org_admin") {
    return [
      workspace,
      {
        title: "Administration",
        admin: true,
        items: [
          { path: "/team", label: "Team & RBAC", Icon: IconShield },
          { path: "/settings", label: "Repos & Settings", Icon: IconSettings },
        ],
      },
    ];
  }

  return [workspace];
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/analytics": "Analytics",
  "/agents": "Agent Pipeline",
  "/team": "Team & RBAC",
  "/settings": "Repos & Settings",
  "/profile": "My Profile",
  "/organization": "Organization",
  "/repos": "Repository",
  "/prs": "PR Report",
  "/organizations": "Organizations",
  "/platform-usage": "Usage Analytics",
};

export function Layout() {
  const { user, logout, needsOnboarding, completeOnboarding } = useAuth();
  const location = useLocation();
  const params = useParams();
  const basePath = "/" + (location.pathname.split("/")[1] || "");
  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgIndustry, setOrgIndustry] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "org_admin" || !user.org_id) {
      setOrgName(null);
      setOrgIndustry(null);
      return;
    }
    apiGet<{ name: string; industry: string | null }>("/api/org/me")
      .then((o) => {
        setOrgName(o.name);
        setOrgIndustry(o.industry);
      })
      .catch(() => {
        setOrgName(null);
        setOrgIndustry(null);
      });
  }, [user]);

  useEffect(() => {
    setDynamicTitle(null);
    if (!user || !canAccessOrgWorkspace(user.role)) return;

    if (basePath === "/repos" && params.repoId) {
      apiGet<RepoRow[]>("/api/repos")
        .then((repos) => {
          const repo = repos.find((r) => r.id === params.repoId);
          setDynamicTitle(repo?.full_name ?? "Repository");
        })
        .catch(() => setDynamicTitle("Repository"));
    } else if (basePath === "/prs" && params.prId) {
      apiGet<PRMeta>(`/api/prs/${params.prId}`)
        .then((pr) => setDynamicTitle(`#${pr.pr_number} ${pr.title ?? "PR Report"}`))
        .catch(() => setDynamicTitle("PR Report"));
    }
  }, [basePath, params.repoId, params.prId, user]);

  useEffect(() => {
    if (!user || canAccessPlatformOps(user.role)) {
      setStats(null);
      return;
    }
    fetchStats<PlatformStats>().then(setStats).catch(() => setStats(null));
  }, [user]);

  useEffect(() => {
    // First login only; Platform Admin never gets a tour.
    if (!user) {
      setTourOpen(false);
      return;
    }
    if (user.role === "platform_admin") {
      setTourOpen(false);
      return;
    }
    if (needsOnboarding()) {
      setTourOpen(true);
    } else {
      setTourOpen(false);
    }
  }, [user?.id, user?.role, user?.onboarding_completed]);

  if (user && !isPathAllowed(user.role, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const sidebarAvatar =
    githubAvatarUrl(user?.github_username, 72) || user?.avatar || null;

  const groups = user ? navForRole(user.role) : [];
  const headerTitle =
    user?.role === "platform_admin" && basePath === "/"
      ? "Command Center"
      : dynamicTitle ?? PAGE_TITLES[basePath] ?? "Review";

  return (
    <div className="min-h-screen bg-black">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r border-ink-700 bg-black">
        <div className="shell-header-side group shrink-0">
          <div className="flex items-center gap-3">
            <VerdictLogo className="verdict-logo h-9 w-9" />
            <div>
              <p className="text-lg font-bold tracking-tight text-white">Verdict</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-300">
                {user?.role === "platform_admin" ? "Platform" : "PR Intelligence"}
              </p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-hidden py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="mono-label px-6 py-2 text-[9px]">
                {group.title}
                {group.admin ? <span className="admin-badge ml-2">ADMIN</span> : null}
              </p>
              <div className="space-y-0.5">
                {group.items
                  .filter((item) => {
                    if (item.path === "/team") return user && canManageTeam(user.role);
                    if (item.path === "/settings") return user && canAccessSettings(user.role);
                    return true;
                  })
                  .map(({ path, label, Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      className={
                        location.pathname === path || (path !== "/" && location.pathname.startsWith(path))
                          ? "nav-active w-full"
                          : "nav-idle w-full"
                      }
                    >
                      <span className="nav-icon transition-transform duration-300">
                        <Icon />
                      </span>
                      {label}
                    </Link>
                  ))}
              </div>
            </div>
          ))}

          {user?.role !== "platform_admin" && (
            <div className="nav-admin-group">
              <p className="mono-label px-5 py-2 text-[9px]">
                Pipeline <span className="admin-badge">LIVE</span>
              </p>
              <p className="px-6 text-[10px] leading-relaxed text-ink-400">
                Groq agents · ESLint · Semgrep · GitHub App
              </p>
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-ink-700 bg-black p-4 space-y-3">
          {user && user.role === "org_admin" && orgName && (
            <Link
              to="/organization"
              className={`flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all duration-300 ${
                location.pathname === "/organization"
                  ? "border-white bg-white/[0.08]"
                  : "border-ink-700 bg-white/[0.03] hover:border-ink-400 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink-600 bg-ink-950 font-mono text-xs font-bold text-white">
                {orgName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{orgName}</p>
                <p className="truncate font-mono text-[9px] uppercase tracking-wider text-ink-400">
                  {orgIndustry || "Organization"}
                </p>
              </div>
            </Link>
          )}
          <Link
            to="/profile"
            className={`flex w-full items-center gap-3 rounded-none border p-3 text-left transition-all duration-300 ${
              location.pathname === "/profile" || location.pathname.startsWith("/profile/")
                ? "border-white bg-white/[0.08]"
                : "border-ink-700 bg-white/[0.03] hover:border-ink-400 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-white font-mono text-sm font-bold text-black">
              {sidebarAvatar ? (
                <img
                  src={sidebarAvatar}
                  alt={user?.name ?? "User"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                user?.name.charAt(0)?.toUpperCase() ?? "?"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className={user ? roleBadgeClass(user.role) : "role-badge"}>
                {user ? ROLE_LABELS[user.role] : ""}
              </p>
              {user?.github_username && (
                <p className="truncate font-mono text-[9px] text-ink-400">@{user.github_username}</p>
              )}
            </div>
          </Link>
          <button type="button" onClick={() => void logout()} className="btn-signout">
            Sign out
          </button>
        </div>
      </aside>

      <div className="ml-64 flex min-h-screen min-w-0 flex-col">
        <header className="shell-header-main">
          <div className="flex w-full items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="mono-label text-ink-100">{dateLabel}</p>
              <h1 className="page-title mt-1 truncate">{headerTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-6">
              {stats && user && canAccessOrgWorkspace(user.role) && (
                <div className="hidden items-center gap-8 md:flex">
                  <div>
                    <p className="mono-label">Avg score</p>
                    <p className="mt-1 text-2xl font-bold text-white">{stats.avg_score ?? "—"}</p>
                  </div>
                  <div className="h-10 w-px bg-ink-800" />
                  <div>
                    <p className="mono-label">PRs</p>
                    <p className="mt-1 text-2xl font-bold text-white">{stats.total_prs}</p>
                  </div>
                </div>
              )}
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
          <Outlet />
        </main>
      </div>

      {user && (
        <OnboardingTour
          open={tourOpen}
          role={user.role}
          onClose={() => {
            setTourOpen(false);
            void completeOnboarding();
          }}
          onComplete={() => void completeOnboarding()}
        />
      )}
    </div>
  );
}
