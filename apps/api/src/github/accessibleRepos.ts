import { Octokit } from "@octokit/rest";
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

function placeholderPrivateRepo(fullName: string): GitHubAccessibleRepo {
  return {
    github_repo_id: 0,
    full_name: fullName,
    installation_id: 0,
    private: true,
    description: null,
    app_has_access: false,
  };
}

/** Public repos for a user or org. No GitHub App installation required. */
async function listPublicRepos(login: string): Promise<GitHubAccessibleRepo[]> {
  const name = login.trim().replace(/^@/, "");
  if (!name) return [];

  const octokit = new Octokit();
  let accountType = "User";
  try {
    const user = await octokit.rest.users.getByUsername({ username: name });
    accountType = user.data.type;
  } catch {
    return [];
  }

  const items =
    accountType === "Organization"
      ? await octokit.paginate(octokit.rest.repos.listForOrg, { org: name, type: "public", per_page: 100 })
      : await octokit.paginate(octokit.rest.repos.listForUser, { username: name, type: "owner", per_page: 100 });

  return items
    .filter((repo) => !repo.private)
    .map((repo) => ({
      github_repo_id: repo.id,
      full_name: repo.full_name,
      installation_id: 0,
      private: false,
      description: repo.description ?? null,
      app_has_access: false,
    }));
}

async function listGrantedRepos(): Promise<GitHubAccessibleRepo[]> {
  if (!isGithubAppConfigured()) return [];
  const app = getGithubApp();
  const merged = new Map<string, GitHubAccessibleRepo>();
  for await (const { octokit, installation } of app.eachInstallation.iterator()) {
    const granted = await listInstallationGrantedRepos(octokit, installation.id);
    for (const repo of granted.values()) {
      merged.set(repo.full_name.toLowerCase(), repo);
    }
  }
  return [...merged.values()];
}

export async function listAccessibleRepos(
  accountLogin = "",
  extraPrivateNames: string[] = [],
): Promise<GitHubAccessibleRepo[]> {
  const merged = new Map<string, GitHubAccessibleRepo>();

  for (const repo of await listPublicRepos(accountLogin)) {
    merged.set(repo.full_name.toLowerCase(), repo);
  }

  for (const repo of await listGrantedRepos()) {
    merged.set(repo.full_name.toLowerCase(), repo);
  }

  for (const raw of extraPrivateNames) {
    const fullName = raw.trim();
    if (!fullName.includes("/")) continue;
    const key = fullName.toLowerCase();
    if (!merged.has(key)) merged.set(key, placeholderPrivateRepo(fullName));
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
