import {
  Paintbrush,
  Highlighter,
  CloudFog,
  SprayCan,
  Eraser,
  X,
  PaintbrushVertical,
  Brush,
  PenTool,
} from "lucide-react";

/**
 * Variant presets — each one sets {tool, variant, opacity, sizeMultiplier}.
 * `tool` is the underlying canvas tool that handles pointer events.
 * `variant` is the visual style used by MapCanvas's ShapeEl renderer.
 */
const VARIANTS = [
  {
    id: "brush",
    label: "Brush",
    desc: "Smooth round freehand",
    icon: Paintbrush,
    tool: "brush",
    variant: "brush",
    opacity: 1,
    sizeMult: 1,
    accent: "amber",
  },
  {
    id: "marker",
    label: "Marker",
    desc: "Thicker, slightly translucent",
    icon: PaintbrushVertical,
    tool: "brush",
    variant: "marker",
    opacity: 0.85,
    sizeMult: 1.8,
    accent: "amber",
  },
  {
    id: "highlighter",
    label: "Highlighter",
    desc: "Wide, very transparent",
    icon: Highlighter,
    tool: "brush",
    variant: "highlighter",
    opacity: 0.45,
    sizeMult: 3.5,
    accent: "yellow",
  },
  {
    id: "fog",
    label: "Fog",
    desc: "War fog — players can't see through it",
    icon: CloudFog,
    tool: "brush",
    variant: "fog",
    opacity: 1,
    sizeMult: 6,
    accent: "slate",
    color: "#0f172a",
  },
  {
    id: "spray",
    label: "Spray",
    desc: "Dotted scatter",
    icon: SprayCan,
    tool: "brush",
    variant: "spray",
    opacity: 0.55,
    sizeMult: 1.5,
    accent: "amber",
  },
  {
    id: "calligraphy",
    label: "Ink Pen",
    desc: "Calligraphic ink",
    icon: PenTool,
    tool: "brush",
    variant: "calligraphy",
    opacity: 1,
    sizeMult: 0.8,
    accent: "amber",
  },
  {
    id: "soft-erase",
    label: "Soft Eraser",
    desc: "Splits brush strokes",
    icon: Eraser,
    tool: "soft-erase",
    variant: null,
    opacity: 1,
    sizeMult: 1,
    accent: "blue",
  },
  {
    id: "hard-erase",
    label: "Hard Eraser",
    desc: "Removes whole shapes",
    icon: Brush,
    tool: "erase",
    variant: null,
    opacity: 1,
    sizeMult: 1,
    accent: "red",
  },
];

// Quick color swatches (D&D / cartography appropriate)
const COLOR_SWATCHES = [
  "#D97706", // amber (default)
  "#EF4444", // red
  "#10B981", // green
  "#3B82F6", // blue
  "#A855F7", // purple
  "#EC4899", // pink
  "#FBBF24", // yellow
  "#F97316", // orange
  "#06B6D4", // cyan
  "#F3F4F6", // white
  "#1F2937", // near-black
];

const ACCENT_CLASSES = {
  amber: {
    active: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-amber-300",
  },
  yellow: {
    active: "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-yellow-300",
  },
  stone: {
    active: "bg-stone-500/15 text-stone-200 ring-1 ring-stone-400/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-stone-200",
  },
  blue: {
    active: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-blue-300",
  },
  slate: {
    active: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-slate-200",
  },
  red: {
    active: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
    idle: "text-stone-400 hover:bg-white/5 hover:text-red-300",
  },
};

export default function PaintPanel({
  tool,
  setTool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  brushOpacity,
  setBrushOpacity,
  brushVariant,
  setBrushVariant,
  onClose,
}) {
  // Match active variant via (tool + variant) tuple
  const activeVariantId =
    VARIANTS.find(
      (v) =>
        v.tool === tool && (v.tool !== "brush" || v.variant === brushVariant),
    )?.id || (tool === "brush" ? "brush" : null);

  const applyVariant = (v) => {
    setTool(v.tool);
    if (v.variant) setBrushVariant(v.variant);
    if (v.color) setColor(v.color);
    setBrushOpacity(v.opacity);
    // Scale brush size sensibly relative to a baseline of 8
    const newSize = Math.max(2, Math.round(8 * v.sizeMult));
    setBrushSize(newSize);
  };

  return (
    <div
      data-testid="paint-panel"
      className="absolute left-20 top-20 z-30 glass rounded-2xl flex flex-col w-[260px] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-4 h-4 text-amber-500" />
          <h2 className="font-display text-lg leading-tight">Paint Tools</h2>
        </div>
        <button
          data-testid="paint-panel-close"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-100 p-1 rounded hover:bg-white/5"
          title="Close paint panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Variant grid */}
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {VARIANTS.map((v) => {
          const Icon = v.icon;
          const active = activeVariantId === v.id;
          const cls = ACCENT_CLASSES[v.accent] || ACCENT_CLASSES.amber;
          return (
            <button
              key={v.id}
              data-testid={`paint-variant-${v.id}`}
              onClick={() => applyVariant(v)}
              title={`${v.label} — ${v.desc}`}
              className={`flex flex-col items-center justify-center gap-1 h-14 rounded-xl transition-all px-1 ${
                active ? cls.active : cls.idle
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
              <span className="text-[9px] font-mono-cart uppercase tracking-wider leading-none">
                {v.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Color picker */}
      <div className="px-3 pb-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono-cart uppercase tracking-widest text-stone-500">
            Color
          </span>
          <input
            data-testid="paint-color-picker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded-md bg-black/30 border border-white/10 cursor-pointer p-0"
            title="Custom color"
          />
        </div>
        <div className="grid grid-cols-11 gap-1">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              data-testid={`paint-swatch-${c}`}
              onClick={() => setColor(c)}
              title={c}
              className={`w-full aspect-square rounded-md transition-all ring-1 ${
                color.toLowerCase() === c.toLowerCase()
                  ? "ring-amber-400 scale-110"
                  : "ring-black/40 hover:scale-110 hover:ring-white/30"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Size slider */}
      <div className="px-3 pb-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono-cart uppercase tracking-widest text-stone-500">
            Size
          </span>
          <span className="text-[10px] font-mono-cart text-amber-300">
            {brushSize}px
          </span>
        </div>
        <input
          data-testid="paint-size-slider"
          type="range"
          min={1}
          max={60}
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Opacity slider */}
      <div className="px-3 pb-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono-cart uppercase tracking-widest text-stone-500">
            Opacity
          </span>
          <span className="text-[10px] font-mono-cart text-amber-300">
            {Math.round(brushOpacity * 100)}%
          </span>
        </div>
        <input
          data-testid="paint-opacity-slider"
          type="range"
          min={10}
          max={100}
          value={Math.round(brushOpacity * 100)}
          onChange={(e) =>
            setBrushOpacity(parseInt(e.target.value, 10) / 100)
          }
          className="w-full accent-amber-500"
        />
      </div>

      {/* Live preview */}
      <div className="mx-3 mb-3 h-12 rounded-lg bg-stone-900/60 border border-white/5 flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 220 40">
          <polyline
            points="10,30 40,12 80,28 120,10 160,30 200,16"
            fill="none"
            stroke={color}
            strokeWidth={Math.max(1, brushSize * 0.7)}
            strokeOpacity={brushOpacity}
            strokeLinecap={
              brushVariant === "highlighter" ? "butt" : "round"
            }
            strokeLinejoin="round"
            strokeDasharray={brushVariant === "spray" ? "1 4" : undefined}
          />
        </svg>
      </div>
    </div>
  );
}
