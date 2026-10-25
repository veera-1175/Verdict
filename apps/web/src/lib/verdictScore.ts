import { useEffect, useState } from "react";
import type { PlatformStats } from "./stats";

const cache = new Map<string, Promise<number | null>>();

export function verdictKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

/** Latest health score posted on the pull request, when Verdict has commented. */
export function fetchLatestVerdictScore(repo: string, prNumber: number): Promise<number | null> {
  const key = verdictKey(repo, prNumber);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return null;
    const comments = (await res.json()) as Array<{ body?: string; created_at?: string }>;
    if (!Array.isArray(comments)) return null;
    const latest = comments
      .filter((comment) => (comment.body ?? "").includes("Overall health score"))
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
      .at(-1);
    const match = latest?.body?.match(/Overall health score:\*\*\s*(\d+)/);
    return match ? Number(match[1]) : null;
  })();

  cache.set(key, pending);
  return pending;
}

export function useLiveScores(items: Array<{ repo: string; prNumber: number }>): Record<string, number> {
  const signature = items.map((item) => verdictKey(item.repo, item.prNumber)).join("|");
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!signature) {
      setScores({});
      return;
    }
    let cancelled = false;
    const parsed = signature.split("|").map((key) => {
      const split = key.lastIndexOf("#");
      return { repo: key.slice(0, split), prNumber: Number(key.slice(split + 1)) };
    });
    Promise.all(
      parsed.map(async (item) => [verdictKey(item.repo, item.prNumber), await fetchLatestVerdictScore(item.repo, item.prNumber)] as const),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [key, score] of rows) {
        if (score != null) next[key] = score;
      }
      setScores(next);
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  return scores;
}

/** Replace saved scores with the score from the latest GitHub review comment. */
export function useCorrectedStats(stats: PlatformStats | null): PlatformStats | null {
  const live = useLiveScores(
    (stats?.recent_activity ?? []).map((row) => ({ repo: row.repo, prNumber: row.pr_number })),
  );
  if (!stats) return null;

  const recent_activity = stats.recent_activity.map((row) => {
    const score = live[verdictKey(row.repo, row.pr_number)];
    return score == null ? row : { ...row, score };
  });

  let sum = (stats.avg_score ?? 0) * stats.total_prs;
  let changed = false;
  for (const row of stats.recent_activity) {
    const score = live[verdictKey(row.repo, row.pr_number)];
    if (score == null || row.score == null || stats.avg_score == null) continue;
    sum += score - row.score;
    changed = true;
  }

  return {
    ...stats,
    recent_activity,
    avg_score: changed && stats.total_prs > 0 ? Math.round(sum / stats.total_prs) : stats.avg_score,
  };
}
