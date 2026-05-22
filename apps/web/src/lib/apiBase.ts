/** Production API host for the Render static site. */
const RENDER_API = "https://verdict-api-x75u.onrender.com";

/** Resolve API base — prefer correct Render URL when hosted on verdict-web. */
export function getApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "verdict-web.onrender.com") return RENDER_API;
    // Ignore mistaken bake pointing at a different verdict-api host
    if (fromEnv.includes("verdict-api.onrender.com") && !fromEnv.includes("x75u")) {
      return RENDER_API;
    }
  }
  return fromEnv;
}
