import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./Modal";
import type { Role } from "../lib/roles";

const ORG_ADMIN_STEPS: { title: string; body: string; path?: string }[] = [
  {
    title: "You are Org Admin",
    body: "You manage this company's repositories, its team, and the reviews on their pull requests.",
  },
  {
    title: "Register repos",
    body: "Register the GitHub repos for this company.",
    path: "/settings",
  },
  {
    title: "Add developers",
    body: "Add the people on this team.",
    path: "/team",
  },
  {
    title: "Reviews",
    body: "Open a pull request to read its review.",
    path: "/",
  },
];

const DEVELOPER_STEPS: { title: string; body: string; path?: string }[] = [
  {
    title: "You are a Developer",
    body: "You see the review reports for the pull requests you opened.",
  },
  {
    title: "Your pull requests",
    body: "Your list shows the pull requests you authored.",
    path: "/",
  },
  {
    title: "Review reports",
    body: "Open a pull request to read its review.",
  },
  {
    title: "Your profile",
    body: "Your name in the sidebar opens your profile.",
    path: "/profile",
  },
];

interface Props {
  open: boolean;
  role: Role;
  onClose: () => void;
  onComplete: () => void;
}

/** First-login tour for Org Admin and Developer only. Platform Admin has no tour. */
export function OnboardingTour({ open, role, onClose, onComplete }: Props) {
  const navigate = useNavigate();
  const steps = role === "org_admin" ? ORG_ADMIN_STEPS : DEVELOPER_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open, role]);

  // Platform Admin (and unknown roles) never show this tour.
  if (!open || role === "platform_admin") return null;

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
