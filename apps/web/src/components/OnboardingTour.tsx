import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./Modal";
import type { Role } from "../lib/roles";

const PLATFORM_STEPS: { title: string; body: string; path?: string }[] = [
  {
    title: "You own Verdict",
    body: "Platform Admin owns the product. You onboard organizations and create Org Admins — you never register client repos or open PR reports.",
  },
  {
    title: "Organizations",
    body: "Create a company and assign its Org Admin. That person runs repos, developers, and reviews for their org.",
    path: "/organizations",
  },
  {
    title: "Usage only",
    body: "Monitor Verdict usage across tenants (orgs, admins, review volume). Client PR contents stay confidential to each org.",
    path: "/platform-usage",
  },
  {
    title: "Hierarchy",
    body: "Platform Admin → Org Admin → Developer. Creating a GitHub repo never auto-promotes anyone.",
    path: "/organizations",
  },
];

const ORG_ADMIN_STEPS: { title: string; body: string; path?: string }[] = [
  {
    title: "You run one company",
    body: "Org Admin manages one organization — register repos, add developers, see all org PR reviews. Platform Admin does not do this for you.",
  },
  {
    title: "Register company repos",
    body: "Settings lists GitHub repos. Register ones where the Verdict App is installed for your org.",
    path: "/settings",
  },
  {
    title: "Add developers",
    body: "Team & RBAC links engineers by GitHub username. They only see PRs they authored.",
    path: "/team",
  },
  {
    title: "See all org PRs",
    body: "You see every review in your org. Developers only see their own. Platform Admin never sees PR contents.",
    path: "/",
  },
];

const DEVELOPER_STEPS: { title: string; body: string; path?: string }[] = [
  {
    title: "You are a Developer",
    body: "Your PRs are reviewed by AI agents. Creating a GitHub repo does not make you Org or Platform Admin.",
  },
  {
    title: "Your scope",
    body: "You only see pull requests you authored — matched to your linked GitHub username.",
    path: "/",
  },
  {
    title: "Review reports",
    body: "Open any of your PRs to see severity, confidence scores, evidence, and suggested fixes.",
  },
  {
    title: "Your profile",
    body: "Click your name in the sidebar. Password changes need Org Admin approval.",
    path: "/profile",
  },
];

interface Props {
  open: boolean;
  role: Role;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTour({ open, role, onClose, onComplete }: Props) {
  const navigate = useNavigate();
  const steps =
    role === "platform_admin"
      ? PLATFORM_STEPS
      : role === "org_admin"
        ? ORG_ADMIN_STEPS
        : DEVELOPER_STEPS;
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function finish() {
    onComplete();
    onClose();
  }

  function handleNext() {
    if (current.path) navigate(current.path);
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <Modal open={open} onClose={finish} titleId="tour-title">
      <ModalHeader title="Getting started" onClose={finish} />
      <ModalBody>
        <p id="tour-title" className="mono-label">
          Step {step + 1} of {steps.length}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-white">{current.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{current.body}</p>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-ghost" onClick={finish}>
          Skip
        </button>
        <button type="button" className="btn-ink" onClick={handleNext}>
          {isLast ? "Done" : "Next"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
