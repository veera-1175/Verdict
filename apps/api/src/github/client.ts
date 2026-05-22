import { readFileSync } from "node:fs";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

let app: App | null = null;

function loadPrivateKey(): string {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY;
  if (inline && !inline.startsWith("your_")) {
    return inline.replace(/\\n/g, "\n");
  }

  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (path) {
    return readFileSync(path, "utf8");
  }

  throw new Error("Set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH");
}

export function isGithubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID) && Boolean(
    process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_PATH,
  );
}

function getApp(): App {
  if (!app) {
    const appId = process.env.GITHUB_APP_ID;
    if (!appId) {
      throw new Error("GITHUB_APP_ID not configured");
    }
    app = new App({
      appId,
      privateKey: loadPrivateKey(),
      Octokit,
    });
  }
  return app;
}

export function getGithubApp(): App {
  return getApp();
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const auth = (await getApp().getInstallationOctokit(installationId)) as Octokit;
  return auth;
}

export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo full_name: ${fullName}`);
  }
  return { owner, repo };
}
