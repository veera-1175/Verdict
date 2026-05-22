import type { PanelInfoData } from "./PanelInfoModal";

export function ClickableKpi({
  label,
  value,
  hint,
  accent,
  onInfo,
  className = "kpi-card",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  onInfo: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className={`dashboard-tile w-full text-left ${className} ${accent ? "border-white/20" : ""}`}
    >
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      <p className="mono-label mt-3 text-[9px] text-ink-600">Click for details</p>
    </button>
  );
}

export function InfoHint({ text }: { text: string }) {
  return (
    <span className="info-hint group/hint relative ml-2 inline-flex align-middle">
      <span className="flex h-4 w-4 cursor-help items-center justify-center border border-ink-600 font-mono text-[10px] text-ink-400 transition-colors group-hover/hint:border-white group-hover/hint:text-white">
        ?
      </span>
      <span className="info-hint-popup bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 opacity-0 transition-opacity group-hover/hint:opacity-100">
        {text}
      </span>
    </span>
  );
}

export type { PanelInfoData };
