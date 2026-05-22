import type { ChangedFile } from "./changedFile.js";
import type { StaticFinding, AgentResult } from "./agentInterface.js";
import { runDomainAgent } from "./runDomainAgent.js";

const AGENTS = [
  "Security",
  "Code Quality",
  "Performance",
  "Architecture",
  "Documentation",
  "Best Practices",
] as const;

type Domain = (typeof AGENTS)[number];

function agent(name: Domain) {
  return (files: ChangedFile[], staticResults: StaticFinding[]): Promise<AgentResult> =>
    runDomainAgent(name, files, staticResults);
}

export const securityAgent = agent("Security");
export const qualityAgent = agent("Code Quality");
export const performanceAgent = agent("Performance");
export const architectureAgent = agent("Architecture");
export const docsAgent = agent("Documentation");
export const bestPracticesAgent = agent("Best Practices");
