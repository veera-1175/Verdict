import { useId } from "react";

/** Verdict logo — animated geometric “V” with corner brackets + shimmer */
export function VerdictLogo({
  className = "h-8 w-8",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const shimmerId = `verdict-shimmer-${uid}`;

  return (
    <svg
      className={`${className} verdict-logo${animated ? " verdict-logo-animated" : ""}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={shimmerId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="45%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.55" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" fill="white" className="verdict-bg" />

      {/* Corner brackets — scan frame */}
      <path className="verdict-corner verdict-corner-tl" d="M5 11V5H11" stroke="black" strokeWidth="1" />
      <path className="verdict-corner verdict-corner-tr" d="M21 5H27V11" stroke="black" strokeWidth="1" />
      <path className="verdict-corner verdict-corner-bl" d="M5 21V27H11" stroke="black" strokeWidth="1" />
      <path className="verdict-corner verdict-corner-br" d="M21 27H27V21" stroke="black" strokeWidth="1" />

      {/* V arms — draw in from top */}
      <path
        className="verdict-v-arm verdict-v-left"
        d="M10 9 L16 24.5"
        stroke="black"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <path
        className="verdict-v-arm verdict-v-right"
        d="M22 9 L16 24.5"
        stroke="black"
        strokeWidth="2.4"
        strokeLinecap="square"
      />

      {/* Solid fill fades in after stroke draw */}
      <path
        className="verdict-v-fill"
        d="M7 9 L16 25 L25 9 L21.5 9 L16 18.5 L10.5 9 Z"
        fill="black"
      />

      {/* Apex pulse — verdict “landed” */}
      <circle className="verdict-apex" cx="16" cy="24.5" r="1.25" fill="white" />

      {/* Shimmer sweep */}
      <rect
        className="verdict-shimmer"
        width="48"
        height="48"
        x="-8"
        y="-8"
        fill={`url(#${shimmerId})`}
        opacity="0.9"
      />
    </svg>
  );
}

export function IconGrid() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v18h18M7 16l4-6 4 3 5-8" />
    </svg>
  );
}

export function IconAgents() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="3" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
      <path d="M12 11v3M8.5 16.5l-2 1M15.5 16.5l2 1" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function IconShieldFeature() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconSpark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  );
}

export function IconChartFeature() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v18h18M7 16l4-6 4 3 5-8" />
    </svg>
  );
}

export function IconBolt() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
