import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  ORG_ADMIN_USER,
  PLATFORM_ADMIN_USER,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SEED_DEVELOPERS,
  type Role,
} from "../lib/roles";
import { VerdictLogo, IconShieldFeature, IconSpark, IconChartFeature, IconBolt } from "../components/Icons";
import Snowfall from "../components/Snowfall";

const FEATURES = [
  { Icon: IconShieldFeature, title: "Security Agent", desc: "Secrets, injection risks, auth bypass detection" },
  { Icon: IconSpark, title: "6-Agent Pipeline", desc: "Parallel Groq reviews with master merge" },
  { Icon: IconChartFeature, title: "Confidence Score", desc: "Deterministic 40/30/20/10 formula per issue" },
  { Icon: IconBolt, title: "GitHub Native", desc: "Auto PR comments and check runs on every push" },
];

const ROLE_ORDER: Role[] = ["platform_admin", "org_admin", "developer"];

export function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [email, setEmail] = useState(PLATFORM_ADMIN_USER.email);
  const [password, setPassword] = useState(PLATFORM_ADMIN_USER.password);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<Role>("platform_admin");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await login(email, password);
    setSubmitting(false);
    if (err) setError(err);
  }

  async function pickRole(role: Role) {
    setActiveRole(role);
    setError(null);
    if (role === "platform_admin") {
      setEmail(PLATFORM_ADMIN_USER.email);
      setPassword(PLATFORM_ADMIN_USER.password);
      const err = await login(PLATFORM_ADMIN_USER.email, PLATFORM_ADMIN_USER.password);
      if (err) setError(err);
    } else if (role === "org_admin") {
      setEmail(ORG_ADMIN_USER.email);
      setPassword(ORG_ADMIN_USER.password);
      const err = await login(ORG_ADMIN_USER.email, ORG_ADMIN_USER.password);
      if (err) setError(err);
    } else {
      const dev = SEED_DEVELOPERS[0];
      setEmail(dev.email);
      setPassword(dev.password);
      const err = await login(dev.email, dev.password);
      if (err) setError(err);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-black">
      <div className="relative z-10 hidden w-[45%] flex-col justify-between overflow-hidden border-r border-ink-800 bg-black p-12 lg:flex">
        <div className="absolute inset-0 animate-grid-drift bg-grid-pattern bg-grid opacity-30" />
        <div className="relative flex items-center gap-3 group">
          <VerdictLogo className="h-12 w-12" />
          <span className="font-mono text-xs tracking-[0.3em] text-ink-500">VERDICT v1.0</span>
        </div>

        <div className="relative space-y-8">
          <h1 className="max-w-md text-6xl font-bold leading-[0.95] tracking-tight text-white xl:text-7xl">
            Intelligence<br />
            <span className="text-ink-200">for your PRs.</span>
          </h1>
          <p className="max-w-sm text-lg leading-relaxed text-ink-100">
            Three roles: Platform Admin owns Verdict (orgs + usage), Org Admin runs a company
            (repos + team), Developers only see their own PRs.
          </p>
        </div>

        <p className="relative font-mono text-xs text-ink-600">
          Platform → Org → Developer → PR reviews
        </p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center bg-ink-950 px-6 py-12 sm:px-12 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-md animate-fade-in-up">
          <div className="mb-10 flex items-center gap-3 group lg:hidden">
            <VerdictLogo className="h-11 w-11" />
            <span className="text-2xl font-bold text-white">Verdict</span>
          </div>

          <p className="mono-label">Authentication</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Sign in</h2>
          <p className="mt-2 text-sm text-ink-500">Pick a role to try the demo hierarchy</p>

          <div className="mt-8 space-y-2">
            {ROLE_ORDER.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => void pickRole(role)}
                className={`role-card w-full text-left ${activeRole === role ? "role-card-active" : "border-ink-700"}`}
              >
                <span>
                  <span className="block font-semibold">{ROLE_LABELS[role]}</span>
                  <span className="mt-1 block text-[11px] font-normal text-ink-400">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest opacity-70">
                  Enter →
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-10 space-y-6">
            <div>
              <label className="mono-label mb-3 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-ink" />
            </div>
            <div>
              <label className="mono-label mb-3 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-ink" />
            </div>
            {error && (
              <div className="animate-fade-in border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
            )}
            <button type="submit" className="btn-ink w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <p className="mono-label">Quick fill</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveRole("platform_admin");
                  setEmail(PLATFORM_ADMIN_USER.email);
                  setPassword(PLATFORM_ADMIN_USER.password);
                }}
                className="tag"
              >
                platform
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole("org_admin");
                  setEmail(ORG_ADMIN_USER.email);
                  setPassword(ORG_ADMIN_USER.password);
                }}
                className="tag"
              >
                org admin
              </button>
              {SEED_DEVELOPERS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setActiveRole("developer");
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="tag"
                  title={`GitHub: ${d.github}`}
                >
                  {d.email.split("@")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="border border-ink-800 bg-black/40 p-4">
                <Icon />
                <p className="mt-3 text-xs font-semibold text-white">{title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <Snowfall />
      </div>
    </div>
  );
}
