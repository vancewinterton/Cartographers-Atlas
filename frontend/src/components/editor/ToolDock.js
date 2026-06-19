import {
  Hand,
  Paintbrush,
  Square,
  Circle as CircleIcon,
  Spline,
  Type,
  MapPin,
  Sparkles,
  Eraser,
  Undo2,
  Redo2,
} from "lucide-react";

const TOOLS = [
  { id: "pan", icon: Hand, label: "Pan" },
  { id: "brush", icon: Paintbrush, label: "Brush" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: CircleIcon, label: "Circle" },
  { id: "polygon", icon: Spline, label: "Polygon" },
  { id: "text", icon: Type, label: "Text" },
  { id: "pin", icon: MapPin, label: "Pin" },
  { id: "ai-redraw", icon: Sparkles, label: "AI Redraw" },
  { id: "erase", icon: Eraser, label: "Erase Shape" },
];

export default function ToolDock({
  tool,
  setTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div
      data-testid="tool-dock"
      className="absolute left-4 top-1/2 -translate-y-1/2 z-30 glass rounded-2xl p-2 flex flex-col gap-1"
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        const ai = t.id === "ai-redraw";
        return (
          <button
            key={t.id}
            data-testid={`tool-${t.id}`}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              active
                ? ai
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-white/10 text-amber-500 ring-1 ring-amber-600/30"
                : ai
                  ? "text-emerald-500/80 hover:bg-white/5 hover:text-emerald-400"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
          </button>
        );
      })}
      <div className="h-px bg-white/10 my-1" />
      <button
        data-testid="undo-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-400 hover:bg-white/5 hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
      >
        <Undo2 className="w-4 h-4" strokeWidth={1.6} />
      </button>
      <button
        data-testid="redo-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-400 hover:bg-white/5 hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
      >
        <Redo2 className="w-4 h-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}
