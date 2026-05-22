import { getInstallationOctokit, isGithubAppConfigured } from "./client.js";
import { listAccessibleRepos } from "./accessibleRepos.js";

export interface GitHubUserResult {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  has_login: boolean;
}

async function getAnyOctokit() {
  const repos = await listAccessibleRepos();
  const withAccess = repos.find((r) => r.app_has_access);
  if (!withAccess) throw new Error("No GitHub App installation available");
  return getInstallationOctokit(withAccess.installation_id);
}

function mapUser(
  data: {
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
    html_url: string;
  },
  existingLogins: Set<string>,
): GitHubUserResult {
  return {
    login: data.login,
    name: data.name,
    email: data.email,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
    has_login: existingLogins.has(data.login.toLowerCase()),
  };
}

export async function searchGithubUsers(
  query: string,
  existingLogins: Set<string>,
): Promise<GitHubUserResult[]> {
  if (!isGithubAppConfigured()) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const octokit = await getAnyOctokit();

  try {
    const exact = await octokit.rest.users.getByUsername({ username: q });
    return [mapUser(exact.data, existingLogins)];
  } catch {
    /* fall through to search */
  }

  const { data } = await octokit.rest.search.users({
    q: `${q} in:login`,
    per_page: 8,
  });

  const users = await Promise.all(
    data.items.slice(0, 8).map(async (item) => {
      try {
        const user = await octokit.rest.users.getByUsername({ username: item.login });
        return mapUser(user.data, existingLogins);
      } catch {
        return null;
      }
    }),
  );

  return users.filter((u): u is GitHubUserResult => u != null);
}
