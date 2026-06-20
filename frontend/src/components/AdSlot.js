import { useState } from "react";
import { X } from "lucide-react";

/**
 * Lightweight, unobtrusive ad placeholder.
 *
 * To wire a real ad network later, drop the network's <script>/<ins> markup
 * inside the inner container (or set REACT_APP_ADSENSE_CLIENT and render an
 * AdSense <ins> here). Until then it shows a subtle labelled slot.
 *
 *  - orientation : "horizontal" (skinny banner) | "vertical" (side rail)
 *  - dismissible : show a small close button (viewer pages)
 *  - className   : extra positioning classes from the parent
 */
export default function AdSlot({
  orientation = "horizontal",
  dismissible = false,
  className = "",
  label = "Advertisement",
  testId = "ad-slot",
}) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  const isVertical = orientation === "vertical";
  const base = isVertical
    ? "w-[160px] min-h-[420px] flex-col"
    : "w-full h-[64px]";

  return (
    <div
      data-testid={testId}
      className={`relative flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] overflow-hidden ${base} ${className}`}
    >
      <div className="flex flex-col items-center justify-center gap-1 text-center px-3 pointer-events-none select-none">
        <span className="font-mono-cart text-[9px] uppercase tracking-[0.25em] text-stone-600">
          {label}
        </span>
        <span className="text-[11px] text-stone-500/70">Your ad here</span>
      </div>
      {dismissible && (
        <button
          data-testid={`${testId}-close`}
          onClick={() => setClosed(true)}
          className="absolute top-1 right-1 text-stone-500 hover:text-stone-200 p-0.5 rounded hover:bg-white/10 pointer-events-auto"
          aria-label="Hide ad"
          title="Hide ad"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
