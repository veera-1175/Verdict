import { describe, expect, it } from "vitest";
import {
  computeVerifiedConfidence,
  crossAgentAgreement,
  evidenceSpecificity,
  staticAnalysisAgreement,
} from "./confidence.js";
import type { AgentIssue, StaticFinding } from "./agents/agentInterface.js";

const baseIssue: AgentIssue = {
  file: "src/auth.ts",
  line: 42,
  title: "Hardcoded secret",
  description: "API key in source",
  evidence: 'const key = "sk-live-abc123"',
  severity: "critical",
  suggestedFix: "Use environment variable",
  selfConfidence: 85,
};

describe("computeVerifiedConfidence", () => {
  it("applies the 40/30/20/10 formula", () => {
    const score = computeVerifiedConfidence({
      agentSelfConfidence: 80,
      staticAnalysisAgreement: 100,
      crossAgentAgreement: 100,
      evidenceSpecificity: 100,
    });
    expect(score).toBe(Math.round(0.4 * 80 + 0.3 * 100 + 0.2 * 100 + 0.1 * 100));
  });

  it("clamps to 0-100", () => {
    expect(
      computeVerifiedConfidence({
        agentSelfConfidence: 0,
        staticAnalysisAgreement: 0,
        crossAgentAgreement: 0,
        evidenceSpecificity: 0,
      }),
    ).toBe(0);
  });
});

describe("staticAnalysisAgreement", () => {
  const findings: StaticFinding[] = [
    { tool: "eslint", file: "src/auth.ts", line: 42, rule: "no-secrets", message: "x", severity: "error" },
  ];

  it("returns 100 for same line", () => {
    expect(staticAnalysisAgreement(baseIssue, findings)).toBe(100);
  });

  it("returns 50 for same file only", () => {
    expect(staticAnalysisAgreement({ ...baseIssue, line: 99 }, findings)).toBe(50);
  });
});

describe("crossAgentAgreement", () => {
  it("returns 100 when two agents flag nearby lines", () => {
    const all = [
      { ...baseIssue, agentName: "Security" },
      { ...baseIssue, line: 44, agentName: "Quality" },
    ];
    expect(crossAgentAgreement(baseIssue, all)).toBe(100);
  });
});

describe("evidenceSpecificity", () => {
  it("returns 100 when evidence quotes diff content", () => {
    const content = 'const key = "sk-live-abc123";\nexport default key;';
    expect(evidenceSpecificity(baseIssue, content)).toBe(100);
  });
});
