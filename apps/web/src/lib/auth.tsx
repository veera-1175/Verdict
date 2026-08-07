import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { normalizeRole, type Role, type User } from "./roles";
import { githubAvatarUrl } from "./githubAvatar";
import { getApiBase } from "./apiBase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  needsOnboarding: () => boolean;
}

const STORAGE_KEY = "verdict-auth-user";

function onboardingKey(userId: string) {
  return `verdict-onboarding-${userId}`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return { ...parsed, role: normalizeRole(String(parsed.role)) };
  } catch {
    return null;
  }
}

function userFromSession(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, string>;
}): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email ?? "github@user",
    name: sessionUser.user_metadata?.full_name ?? sessionUser.email ?? "GitHub User",
    role: "developer",
    org_id: "org-veera",
    github_username: sessionUser.user_metadata?.user_name,
    avatar: sessionUser.user_metadata?.avatar_url,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(userFromSession(data.session.user));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = userFromSession(session.user);
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else if (!loadStoredUser()) {
        setUser(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function persist(u: User | null) {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function authHeadersFor(u: User): Record<string, string> {
    const headers: Record<string, string> = {};
    if (u.id) headers["X-Verdict-User-Id"] = u.id;
    if (u.role) headers["X-Verdict-Role"] = u.role;
    if (u.github_username) headers["X-Verdict-Github-Username"] = u.github_username;
    if (u.org_id) headers["X-Verdict-Org-Id"] = u.org_id;
    return headers;
  }

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return body?.error || (res.status === 403 ? "Organization deactivated" : "Invalid credentials");
      }
      const data = (await res.json()) as User;
      const role = normalizeRole(String(data.role));
      const onboardingDone =
        role === "platform_admin" ||
        data.onboarding_completed === true ||
        localStorage.getItem(onboardingKey(data.id)) === "true";
      if (onboardingDone) {
        localStorage.setItem(onboardingKey(data.id), "true");
      }
      persist({
        ...data,
        role,
        avatar: githubAvatarUrl(data.github_username) ?? undefined,
        onboarding_completed: onboardingDone,
      });
      return null;
    } catch {
      return "Could not reach the API";
    }
  }

  async function refreshProfile() {
    if (!user) return;
    try {
      const res = await fetch(`${getApiBase()}/api/profile`, { headers: authHeadersFor(user) });
      if (!res.ok) return;
      const profile = (await res.json()) as User;
      const role = normalizeRole(String(profile.role));
      const onboardingDone =
        role === "platform_admin" ||
        profile.onboarding_completed === true ||
        user.onboarding_completed === true ||
        localStorage.getItem(onboardingKey(user.id)) === "true";
      persist({
        ...user,
        ...profile,
        role,
        avatar: githubAvatarUrl(profile.github_username) ?? undefined,
        onboarding_completed: onboardingDone,
      });
    } catch {
      /* ignore */
    }
  }

  async function completeOnboarding() {
    if (!user) return;
    localStorage.setItem(onboardingKey(user.id), "true");
    try {
      await fetch(`${getApiBase()}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeadersFor(user) },
        body: JSON.stringify({ complete_onboarding: true }),
      });
    } catch {
      /* ignore */
    }
    persist({ ...user, onboarding_completed: true });
  }

  function needsOnboarding() {
    if (!user) return false;
    // Platform Admin has no product tour — only Org Admin and Developer.
    if (user.role === "platform_admin") return false;
    if (user.onboarding_completed) return false;
    return localStorage.getItem(onboardingKey(user.id)) !== "true";
  }

  async function logout() {
    persist(null);
    if (supabase) await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole: (...roles) => (user ? roles.includes(user.role) : false),
        refreshProfile,
        completeOnboarding,
        needsOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
