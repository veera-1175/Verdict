import { getGithubApp, getInstallationOctokit, isGithubAppConfigured, parseRepoFullName } from "./client.js";

export interface GitHubAccessibleRepo {
  github_repo_id: number;
  full_name: string;
  installation_id: number;
  private: boolean;
  description: string | null;
  /** Verdict GitHub App can receive webhooks for this repo */
  app_has_access: boolean;
}

export interface GitHubCollaborator {
  login: string;
  name: string;
  avatar_url: string | null;
  role: string | null;
}

async function listInstallationGrantedRepos(
  octokit: { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: { repositories: Array<{
    id: number; full_name: string; private: boolean; description: string | null;
  }> } }> },
  installationId: number,
): Promise<Map<number, GitHubAccessibleRepo>> {
  const map = new Map<number, GitHubAccessibleRepo>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await octokit.request("GET /installation/repositories", {
      per_page: 100,
      page,
    });

    for (const repo of data.repositories) {
      map.set(repo.id, {
        github_repo_id: repo.id,
        full_name: repo.full_name,
        installation_id: installationId,
        private: repo.private,
        description: repo.description,
        app_has_access: true,
      });
    }

    hasMore = data.repositories.length === 100;
    page += 1;
  }

  return map;
}

async function listAccountRepos(
  octokit: { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: Array<{
    id: number; full_name: string; private: boolean; description: string | null;
  }> }> },
  installationId: number,
  account: { login?: string; type?: string } | null,
): Promise<Map<number, GitHubAccessibleRepo>> {
  const map = new Map<number, GitHubAccessibleRepo>();
  const login = account?.login;
  if (!login) return map;

  const route =
    account?.type === "Organization"
      ? "GET /orgs/{org}/repos"
      : "GET /users/{username}/repos";

  try {
    let page = 1;
    while (true) {
      const params =
        account?.type === "Organization"
          ? { org: login, type: "all", per_page: 100, page, sort: "updated" }
          : { username: login, type: "owner", per_page: 100, page, sort: "updated" };

      const { data } = await octokit.request(route, params);
      for (const repo of data) {
        map.set(repo.id, {
          github_repo_id: repo.id,
          full_name: repo.full_name,
          installation_id: installationId,
          private: repo.private,
          description: repo.description,
          app_has_access: false,
        });
      }
      if (data.length < 100) break;
      page += 1;
    }
  } catch (err) {
    console.warn("[github] listAccountRepos failed:", (err as Error).message);
  }

  return map;
}

export async function listAccessibleRepos(): Promise<GitHubAccessibleRepo[]> {
  if (!isGithubAppConfigured()) {
    throw new Error("GitHub App not configured — set GITHUB_APP_ID and private key in .env");
  }

  const app = getGithubApp();
  const merged = new Map<number, GitHubAccessibleRepo>();

  for await (const { octokit, installation } of app.eachInstallation.iterator()) {
    const installationId = installation.id;

    const granted = await listInstallationGrantedRepos(octokit, installationId);
    const account = await listAccountRepos(octokit, installationId, installation.account);

    for (const [id, repo] of account) {
      merged.set(id, repo);
    }
    for (const [id, repo] of granted) {
      merged.set(id, repo);
    }
  }

  return [...merged.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function verifyAccessibleRepo(
  githubRepoId: number,
  fullName: string,
  installationId: number,
): Promise<GitHubAccessibleRepo> {
  const repos = await listAccessibleRepos();
  const match = repos.find(
    (r) =>
      r.github_repo_id === githubRepoId &&
      r.full_name.toLowerCase() === fullName.toLowerCase() &&
      r.installation_id === installationId,
  );
  if (!match) {
    throw new Error("Repository not found — pick a repo from your GitHub account list");
  }
  if (!match.app_has_access) {
    throw new Error(
      `Verdict GitHub App is not installed on ${fullName}. Open GitHub App settings and grant access to this repository first.`,
    );
  }
  return match;
}

export async function listRepoCollaborators(
  installationId: number,
  fullName: string,
): Promise<GitHubCollaborator[]> {
  const { owner, repo } = parseRepoFullName(fullName);
  const octokit = await getInstallationOctokit(installationId);

  try {
    const collaborators = await octokit.paginate(octokit.rest.repos.listCollaborators, {
      owner,
      repo,
      per_page: 100,
    });

    return collaborators.map((c) => ({
      login: c.login ?? "unknown",
      name: (c as { name?: string | null }).name ?? c.login ?? "Unknown",
      avatar_url: c.avatar_url ?? null,
      role: (c as { role?: string }).role ?? null,
    }));
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 403 || status === 404) {
      const contributors = await octokit.paginate(octokit.rest.repos.listContributors, {
        owner,
        repo,
        per_page: 100,
      });
      return contributors
        .filter((c) => c.login)
        .map((c) => ({
          login: c.login!,
          name: c.login!,
          avatar_url: c.avatar_url ?? null,
          role: "contributor",
        }));
    }
    throw err;
  }
}
