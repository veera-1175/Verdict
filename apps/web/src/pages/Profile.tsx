import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { useNotification } from "../lib/notification";
import { githubAvatarUrl } from "../lib/githubAvatar";
import { DEMO_ORG, ROLE_LABELS, type Role } from "../lib/roles";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  github_username?: string;
  avatar?: string | null;
  onboarding_completed?: boolean;
  password_change_pending?: boolean;
}

interface OrgExtras {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  address: string;
}

const ORG_EXTRAS_KEY = "verdict-org-admin-profile";
const MAX_AVATAR_EDGE = 256;
const MAX_AVATAR_CHARS = 500_000;

function loadOrgExtras(fallbackName: string, fallbackEmail: string): OrgExtras {
  try {
    const raw = localStorage.getItem(ORG_EXTRAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OrgExtras>;
      return {
        contact_name: parsed.contact_name || fallbackName,
        contact_email: parsed.contact_email || fallbackEmail,
        contact_phone: parsed.contact_phone || "",
        website: parsed.website || "",
        address: parsed.address || "",
      };
    }
  } catch {
    /* ignore */
  }
  return {
    contact_name: fallbackName,
    contact_email: fallbackEmail,
    contact_phone: "",
    website: "",
    address: "",
  };
}

/** Resize + compress to JPEG data URL for local DB storage. */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > MAX_AVATAR_CHARS && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > MAX_AVATAR_CHARS) {
          reject(new Error("Image still too large after compression"));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function Profile() {
  const { user, refreshProfile } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [clearAvatar, setClearAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requesting, setRequesting] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");

  const role = user?.role;
  const isPlatform = role === "platform_admin";
  const isOrgAdmin = role === "org_admin";
  const isDeveloper = role === "developer";

  function load() {
    setLoading(true);
    apiGet<ProfileData>("/api/profile")
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setAvatarPreview(p.avatar || null);
        setAvatarDirty(false);
        setClearAvatar(false);
        if (user?.role === "org_admin") {
          const extras = loadOrgExtras(p.name || user.name, p.email);
          setContactName(extras.contact_name);
          setContactEmail(extras.contact_email);
          setContactPhone(extras.contact_phone);
          setWebsite(extras.website);
          setAddress(extras.address);
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickAvatar(file: File | null) {
    if (!file || !isPlatform) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
      setAvatarDirty(true);
      setClearAvatar(false);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not use that image");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim() };
      if (isPlatform) {
        if (clearAvatar) payload.clear_avatar = true;
        else if (avatarDirty && avatarPreview) payload.avatar = avatarPreview;
      }
      await apiPatch("/api/profile", payload);
      if (isOrgAdmin) {
        localStorage.setItem(
          ORG_EXTRAS_KEY,
          JSON.stringify({
            contact_name: contactName.trim(),
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim(),
            website: website.trim(),
            address: address.trim(),
          }),
        );
      }
      notifySuccess("Profile updated");
      load();
      void refreshProfile();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function requestPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notifyError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      notifyError("New password must be at least 6 characters");
      return;
    }
    setRequesting(true);
    try {
      if (isPlatform) {
        await apiPatch("/api/profile", {
          current_password: currentPassword,
          new_password: newPassword,
        });
        notifySuccess("Password updated");
      } else {
        await apiPost("/api/profile/password-request", {
          current_password: currentPassword,
          new_password: newPassword,
        });
        notifySuccess(
          isOrgAdmin
            ? "Password change submitted — awaiting Platform Admin approval"
            : "Password change submitted — awaiting Org Admin approval",
        );
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="border border-ink-600 bg-ink-900 px-5 py-4 text-sm text-ink-200">
        Could not load your profile.
      </div>
    );
  }

  const displayName = name || profile.name || user.name || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const githubUser = isPlatform ? "" : profile.github_username || user.github_username || "";
  const ghAvatar = !isPlatform ? githubAvatarUrl(githubUser, 192) : null;
  const shownAvatar = isPlatform
    ? clearAvatar
      ? null
      : avatarPreview || profile.avatar || null
    : ghAvatar;

  const title = isPlatform
    ? "Platform Admin Profile"
    : isOrgAdmin
      ? "Org Admin Profile"
      : "My Profile";

  const subtitle = isPlatform
    ? "Normal Verdict operator account — update your name and profile picture. Not linked to GitHub."
    : isOrgAdmin
      ? `Manage your details for ${DEMO_ORG.name}. Password changes need Platform Admin approval.`
      : "Update your display name. Password changes need Org Admin approval.";

  return (
    <div className="space-y-10">
      <div>
        <p className="mono-label">Account</p>
        <h3 className="mt-2 text-3xl font-bold text-white">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">{subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="panel p-8 lg:col-span-1">
          <p className="mono-label">Profile Picture</p>
          <div className="mt-6 flex flex-col items-center gap-4">
            {shownAvatar ? (
              <img
                src={shownAvatar}
                alt={displayName}
                className="h-24 w-24 shrink-0 border border-ink-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-white font-mono text-3xl font-bold text-black">
                {initial}
              </div>
            )}

            {isPlatform ? (
              <div className="flex w-full flex-col items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload photo
                </button>
                {(avatarPreview || profile.avatar) && !clearAvatar ? (
                  <button
                    type="button"
                    className="text-[10px] text-ink-400 underline hover:text-ink-200"
                    onClick={() => {
                      setClearAvatar(true);
                      setAvatarPreview(null);
                      setAvatarDirty(true);
                    }}
                  >
                    Remove photo
                  </button>
                ) : null}
                <p className="text-center text-[10px] text-ink-500">
                  JPG/PNG · stored in your Verdict profile · not from GitHub
                </p>
              </div>
            ) : (
              <p className="text-center text-[10px] text-ink-500">
                {githubUser ? `From GitHub @${githubUser}` : "No GitHub username linked"}
              </p>
            )}
          </div>

          <dl className="mt-8 space-y-4 border-t border-ink-800 pt-6 text-sm">
            {[
              ["Email", profile.email],
              ["Role", ROLE_LABELS[user.role as Role]],
              ...(githubUser ? [["GitHub", `@${githubUser}`] as const] : []),
              ...(isOrgAdmin ? [["Organization", DEMO_ORG.name] as const] : []),
            ].map(([label, value]) => (
              <div key={label} className="border-b border-ink-900 pb-3">
                <dt className="mono-label text-[9px]">{label}</dt>
                <dd className="mt-1 text-ink-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-ink-800 pt-6">
            <p className="mono-label">Password</p>
            {!isPlatform && profile.password_change_pending ? (
              <p className="mt-3 border border-ink-600 bg-ink-900 px-3 py-3 text-sm text-ink-200">
                A password change request is pending approval. Keep using your current password.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-ink-500">
                  {isPlatform
                    ? "Change your password directly — no approval needed."
                    : isOrgAdmin
                      ? "Requests go to Platform Admin for approval."
                      : "Requests go to your Org Admin for approval."}
                </p>
                <form onSubmit={(e) => void requestPasswordChange(e)} className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mono-label text-[9px]">Current password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[9px]">Confirm new password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-ink mt-2 w-full text-sm"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </label>
                  <button type="submit" disabled={requesting} className="btn-ghost text-sm">
                    {requesting
                      ? isPlatform
                        ? "Updating…"
                        : "Submitting…"
                      : isPlatform
                        ? "Update password"
                        : "Request password change"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <form onSubmit={(e) => void saveProfile(e)} className="space-y-8 lg:col-span-2">
          <div className="panel p-8">
            <p className="mono-label">Your details</p>
            <label className="mt-6 block">
              <span className="mono-label text-[9px]">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-ink mt-2 w-full text-sm"
                required
                minLength={2}
              />
            </label>
            {isPlatform && (
              <label className="mt-6 block">
                <span className="mono-label text-[9px]">Email</span>
                <input
                  value={profile.email}
                  disabled
                  className="input-ink mt-2 w-full text-sm opacity-60"
                />
              </label>
            )}
          </div>

          {isOrgAdmin && (
            <div className="panel p-8">
              <p className="mono-label">Organization contact</p>
              <p className="mt-2 text-xs text-ink-500">
                Contact details for {DEMO_ORG.name}. Stored for this demo session.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mono-label text-[9px]">Contact name</span>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input-ink mt-2 w-full text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Contact email</span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="input-ink mt-2 w-full text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Phone</span>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="input-ink mt-2 w-full text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">Website</span>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="input-ink mt-2 w-full text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mono-label text-[9px]">Address</span>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="input-ink mt-2 w-full text-sm"
                  />
                </label>
              </div>
            </div>
          )}

          {isDeveloper && (
            <div className="panel p-8">
              <p className="mono-label">Access scope</p>
              <p className="mt-2 text-xs text-ink-500">
                You only see PRs authored by your linked GitHub username. Contact your Org Admin to
                change it.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mono-label text-[9px]">Email</span>
                  <input value={profile.email} disabled className="input-ink mt-2 w-full text-sm opacity-60" />
                </label>
                <label className="block">
                  <span className="mono-label text-[9px]">GitHub</span>
                  <input
                    value={githubUser ? `@${githubUser}` : "—"}
                    disabled
                    className="input-ink mt-2 w-full text-sm opacity-60"
                  />
                </label>
              </div>
            </div>
          )}

          {isPlatform && (
            <div className="panel p-8">
              <p className="mono-label">Platform scope</p>
              <p className="mt-2 text-sm text-ink-300">
                You operate Verdict itself — organizations, Org Admins, and usage. You do not
                register client repos or open PR reports, and your account is not linked to GitHub.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-ink min-w-[160px]">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
