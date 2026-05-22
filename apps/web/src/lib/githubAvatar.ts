/** GitHub profile avatar — not editable; always pulled from GitHub. */
export function githubAvatarUrl(username?: string | null, size = 96): string | null {
  if (!username?.trim()) return null;
  const clean = username.trim().replace(/^@/, "");
  return `https://github.com/${encodeURIComponent(clean)}.png?size=${size}`;
}
