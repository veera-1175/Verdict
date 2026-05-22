import type { ChangedFile } from "./agents/changedFile.js";
import { runMasterAgent } from "./agents/masterAgent.js";
import {
  architectureAgent,
  bestPracticesAgent,
  docsAgent,
  performanceAgent,
  qualityAgent,
  securityAgent,
} from "./agents/index.js";
import { saveReport, setPullRequestStatus, upsertPullRequest, upsertRepo } from "./db/queries.js";
import { fetchChangedFiles } from "./github/fetchDiff.js";
import { postGithubComment } from "./github/postComment.js";
import { isGithubAppConfigured } from "./github/client.js";
import { runStaticAnalysis } from "./static-analysis/index.js";

const DEMO_FILES: ChangedFile[] = [
  {
    path: "src/auth.ts",
    content: `export function getApiKey() {
  const key = "sk-live-hardcoded-secret-abc123";
  return key;
}
`,
    patch: "+const key = \"sk-live-hardcoded-secret-abc123\";",
    status: "modified",
  },
  {
    path: "src/db.ts",
    content: `export async function getUsers() {
  const users = await db.query("SELECT * FROM users");
  for (const u of users) {
    const orders = await db.query("SELECT * FROM orders WHERE user_id = " + u.id);
  }
  return users;
}
`,
    patch: "+N+1 query pattern",
    status: "modified",
  },
];

async function runAgentsOnFiles(files: ChangedFile[]) {
  const staticFindings = await runStaticAnalysis(files);

  const agentFns = [
    securityAgent,
    qualityAgent,
    performanceAgent,
    architectureAgent,
    docsAgent,
    bestPracticesAgent,
  ];

  const results = await Promise.all(
    agentFns.map(async (fn) => {
      try {
        return await fn(files, staticFindings);
      } catch (err) {
        const name = fn.name || "Agent";
        console.warn(`[orchestrator] ${name} failed:`, (err as Error).message);
        return {
          agentName: name,
          issues: [],
          summary: `${name} failed: ${(err as Error).message}`,
        };
      }
    }),
  );

  return { results, staticFindings };
}

export async function runReviewWithFiles(prId: string, files: ChangedFile[]): Promise<void> {
  console.log("[orchestrator] starting review", prId);

  try {
    await setPullRequestStatus(prId, "reviewing");

    const { results, staticFindings } = await runAgentsOnFiles(files);
    const report = await runMasterAgent(results, staticFindings, files);
    await saveReport(prId, report);

    if (isGithubAppConfigured()) {
      try {
        await postGithubComment(prId, report);
      } catch (err) {
        console.warn("[orchestrator] GitHub comment skipped:", (err as Error).message);
      }
    }

    console.log("[orchestrator] review complete", {
      prId,
      score: report.overallScore,
      issues: report.issues.length,
    });
  } catch (err) {
    console.error("[orchestrator] review failed:", (err as Error).message);
    await setPullRequestStatus(prId, "failed").catch(() => undefined);
    throw err;
  }
}

export async function runReview(prId: string): Promise<void> {
  const files = await fetchChangedFiles(prId);
  await runReviewWithFiles(prId, files);
}

export async function runDemoReview(): Promise<{ repoId: string; prId: string }> {
  const repoId = await upsertRepo({
    githubRepoId: 9001,
    fullName: "demo/verdict-sample",
  });

  const prId = await upsertPullRequest({
    repoId,
    prNumber: 1,
    title: "Demo PR — hardcoded secrets & N+1 queries",
    author: "verdict-bot",
    installationId: 0,
    headSha: "demo-sha",
  });

  await runReviewWithFiles(prId, DEMO_FILES);
  return { repoId, prId };
}
