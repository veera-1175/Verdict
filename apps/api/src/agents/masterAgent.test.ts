import { describe, expect, it } from "vitest";
import { computeOverallScore, mergeAgentIssues } from "./masterAgent.js";
import type { AgentResult, StaticFinding } from "./agentInterface.js";
import type { ChangedFile } from "./changedFile.js";

const files: ChangedFile[] = [
  {
    path: "src/auth.ts",
    content: 'const key = "sk-live-abc123";\nexport default key;',
    patch: "+const key = ...",
    status: "modified",
  },
];

const staticFindings: StaticFinding[] = [
  {
    tool: "eslint",
    file: "src/auth.ts",
    line: 1,
    rule: "no-secrets",
    message: "Hardcoded secret",
    severity: "error",
  },
];

describe("mergeAgentIssues", () => {
  it("dedupes similar issues from multiple agents", () => {
    const results: AgentResult[] = [
      {
        agentName: "Security",
        summary: "ok",
        issues: [
          {
            file: "src/auth.ts",
            line: 1,
            title: "Hardcoded API key",
            description: "Secret in source",
            evidence: 'const key = "sk-live-abc123"',
            severity: "critical",
            suggestedFix: "Use env var",
            selfConfidence: 90,
          },
        ],
      },
      {
        agentName: "Code Quality",
        summary: "ok",
        issues: [
          {
            file: "src/auth.ts",
            line: 1,
            title: "Hardcoded API key in auth module",
            description: "Should not commit secrets",
            evidence: 'const key = "sk-live-abc123"',
            severity: "high",
            suggestedFix: "Move to config",
            selfConfidence: 75,
          },
        ],
      },
    ];

    const merged = mergeAgentIssues(results, staticFindings, files);
    expect(merged).toHaveLength(1);
    expect(merged[0].agentSources).toContain("Security");
    expect(merged[0].agentSources).toContain("Code Quality");
    expect(merged[0].verifiedConfidence).toBeGreaterThan(0);
    expect(merged[0].confidenceExplanation).toContain("40% agent");
  });
});

describe("computeOverallScore", () => {
  it("returns 100 when no issues", () => {
    expect(computeOverallScore([])).toBe(100);
  });

  it("lowers score for high severity issues", () => {
    const score = computeOverallScore([
      {
        file: "a.ts",
        line: 1,
        title: "x",
        description: "",
        evidence: "x",
        severity: "critical",
        suggestedFix: "",
        selfConfidence: 100,
        agentSources: ["Security"],
        verifiedConfidence: 100,
        confidenceExplanation: "",
      },
    ]);
    expect(score).toBeLessThan(100);
  });
});
