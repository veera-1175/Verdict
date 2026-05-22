import type { ReviewReport } from "../agents/agentInterface.js";
import { getInstallationOctokit, parseRepoFullName } from "./client.js";
import { getPullRequestRow } from "../db/queries.js";

function formatComment(report: ReviewReport, dashboardUrl: string, prId: string): string {
  const critical = report.issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const lines = [
    "## Verdict — AI code review",
    "",
    `**Overall health score:** ${report.overallScore}/100`,
    "",
    report.summary,
    "",
  ];

  if (critical.length > 0) {
    lines.push("### Critical / high issues", "");
    for (const issue of critical.slice(0, 8)) {
      const loc = `${issue.file}${issue.line ? `:${issue.line}` : ""}`;
      lines.push(`#### ${issue.severity.toUpperCase()} — ${issue.title}`);
      lines.push(`\`${loc}\` · ${issue.verifiedConfidence}% confidence`);
      lines.push("");
      if (issue.description?.trim()) {
        lines.push(issue.description.trim());
        lines.push("");
      }
      if (issue.suggestedFix?.trim()) {
        lines.push(`**How to fix:** ${issue.suggestedFix.trim()}`);
        lines.push("");
      }
    }
  }

  lines.push(`[View full report in Verdict](${dashboardUrl}/prs/${prId})`);
  return lines.join("\n");
}

export async function postGithubComment(prId: string, report: ReviewReport): Promise<void> {
  const pr = await getPullRequestRow(prId);
  const octokit = await getInstallationOctokit(pr.installation_id!);
  const { owner, repo } = parseRepoFullName(pr.repo_full_name);

  const dashboardUrl = process.env.PUBLIC_DASHBOARD_URL ?? "http://localhost:5173";
  const body = formatComment(report, dashboardUrl, prId);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr.pr_number,
    body,
  });

  const threshold = Number(process.env.AUTO_FAIL_SCORE_THRESHOLD ?? 60);
  const conclusion = report.overallScore >= threshold ? "success" : "failure";

  try {
    await octokit.checks.create({
      owner,
      repo,
      name: "Verdict",
      head_sha: pr.head_sha ?? "",
      status: "completed",
      conclusion,
      output: {
        title: `Verdict score: ${report.overallScore}/100`,
        summary: report.summary,
      },
    });
  } catch (err) {
    console.warn("[github] check run skipped:", (err as Error).message);
  }
}
