import { getInstallationOctokit, parseRepoFullName } from "./client.js";

export interface GitHubOpenPull {
  number: number;
  title: string;
  author: string;
  head_sha: string;
  html_url: string;
  updated_at: string;
}

export async function listOpenPullRequests(
  installationId: number,
  fullName: string,
): Promise<GitHubOpenPull[]> {
  const octokit = await getInstallationOctokit(installationId);
  const { owner, repo } = parseRepoFullName(fullName);

  const pulls = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 30,
    sort: "updated",
    direction: "desc",
  });

  return pulls.map((p) => ({
    number: p.number,
    title: p.title ?? "Untitled",
    author: p.user?.login ?? "unknown",
    head_sha: p.head?.sha ?? "",
    html_url: p.html_url,
    updated_at: p.updated_at ?? new Date().toISOString(),
  }));
}
