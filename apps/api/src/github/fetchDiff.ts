import type { ChangedFile } from "../agents/changedFile.js";
import { getInstallationOctokit, parseRepoFullName } from "./client.js";
import { getPullRequestRow } from "../db/queries.js";

export async function fetchChangedFiles(prId: string): Promise<ChangedFile[]> {
  const pr = await getPullRequestRow(prId);
  if (!pr.installation_id) {
    throw new Error("PR missing installation_id");
  }

  const octokit = await getInstallationOctokit(pr.installation_id);
  const { owner, repo } = parseRepoFullName(pr.repo_full_name);

  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pr.pr_number,
    per_page: 100,
  });

  const changed: ChangedFile[] = [];

  for (const file of files) {
    if (file.status === "removed") {
      continue;
    }

    let content = "";
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pr.head_sha ?? undefined,
      });
      if ("content" in data && typeof data.content === "string") {
        content = Buffer.from(data.content, "base64").toString("utf8");
      }
    } catch {
      content = file.patch ?? "";
    }

    changed.push({
      path: file.filename,
      content,
      patch: file.patch ?? "",
      status: (file.status as ChangedFile["status"]) ?? "modified",
    });
  }

  return changed;
}
