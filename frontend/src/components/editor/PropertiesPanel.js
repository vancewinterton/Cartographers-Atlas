import { Slider } from "../ui/slider";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, X } from "lucide-react";

const PALETTE = [
  "#D97706",
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#3B82F6",
  "#A855F7",
  "#F3F2F0",
  "#0B0A09",
];

export default function PropertiesPanel({
  tool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  layers,
  setLayers,
  activeLayerId,
  setActiveLayerId,
  shapes,
  setShapes,
  pins,
  pinColorFilter,
  setPinColorFilter,
  showTokenLabels,
  setShowTokenLabels,
  showHealthBars,
  setShowHealthBars,
  showGhostTrails,
  setShowGhostTrails,
  onClose,
}) {
  const addLayer = () => {
    const id = "L" + (layers.length + 1) + "_" + Math.random().toString(36).slice(2, 6);
    setLayers([
      ...layers,
      { id, name: `Layer ${layers.length + 1}`, visible: true, locked: false },
    ]);
    setActiveLayerId(id);
  };

  const removeLayer = (id) => {
    if (layers.length === 1) return;
    setLayers(layers.filter((l) => l.id !== id));
    setShapes(shapes.filter((s) => s.layerId !== id));
    if (activeLayerId === id) setActiveLayerId(layers[0].id);
  };

  const toggleVisible = (id) =>
    setLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  const toggleLock = (id) =>
    setLayers(layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)));

  return (
    <div
      data-testid="properties-panel"
      className="absolute right-4 top-20 bottom-4 z-30 w-80 glass rounded-2xl overflow-y-auto"
    >
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-4 pb-3 bg-gradient-to-b from-[#1a1714ee] via-[#1a1714cc] to-transparent backdrop-blur-md">
        <span className="font-mono-cart text-[10px] uppercase tracking-[0.25em] text-stone-500">
          Tools &amp; Layers
        </span>
        <button
          data-testid="properties-close"
          onClick={onClose}
          title="Hide panel (pop back by picking a tool)"
          className="w-8 h-8 rounded-full bg-black/50 ring-1 ring-white/15 text-stone-200 hover:text-amber-500 hover:bg-amber-500/10 hover:ring-amber-700/40 flex items-center justify-center transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 pb-5">
      {/* Brush */}
      <Section title="Stroke">
        <div className="grid grid-cols-8 gap-2 mb-3">
          {PALETTE.map((c) => (
            <button
              key={c}
              data-testid={`color-${c}`}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full border transition ${
                color === c
                  ? "border-amber-500 ring-2 ring-amber-500/40"
                  : "border-white/10 hover:border-white/30"
              }`}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Input
            data-testid="color-input"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-9 p-0 bg-transparent border-white/10"
          />
          <span className="font-mono-cart text-xs text-stone-400">{color.toUpperCase()}</span>
        </div>

        <div className="mt-4">
          <Label>
            Size <span className="font-mono-cart text-stone-500">{brushSize}px</span>
          </Label>
          <Slider
            data-testid="brush-size-slider"
            min={1}
            max={60}
            step={1}
            value={[brushSize]}
            onValueChange={(v) => setBrushSize(v[0])}
            className="mt-2"
          />
        </div>
      </Section>

      {/* Layers */}
      <Section
        title="Layers"
        action={
          <button
            data-testid="add-layer-btn"
            onClick={addLayer}
            className="text-stone-400 hover:text-amber-500 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        }
      >
        <div className="space-y-1.5">
          {layers
            .slice()
            .reverse()
            .map((l) => {
              const active = activeLayerId === l.id;
              return (
                <div
                  key={l.id}
                  data-testid={`layer-${l.id}`}
                  onClick={() => setActiveLayerId(l.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition ${
                    active
                      ? "bg-amber-600/10 ring-1 ring-amber-700/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(l.id);
                    }}
                    className="text-stone-400 hover:text-stone-100"
                    data-testid={`layer-visible-${l.id}`}
                  >
                    {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(l.id);
                    }}
                    className="text-stone-400 hover:text-stone-100"
                  >
                    {l.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <span className={`text-sm flex-1 ${active ? "text-amber-500" : "text-stone-200"}`}>
                    {l.name}
                  </span>
                  {layers.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLayer(l.id);
                      }}
                      className="text-stone-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </Section>

      <Section title="Tool">
        <p className="text-sm text-stone-400 leading-relaxed">
          {toolHelp(tool)}
        </p>
      </Section>

      <Section title="Display">
        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-lg px-2.5 py-2 bg-black/20">
            <span className="text-sm text-stone-200">Show token names</span>
            <Switch
              data-testid="toggle-token-labels"
              checked={!!showTokenLabels}
              onCheckedChange={setShowTokenLabels}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg px-2.5 py-2 bg-black/20">
            <span className="text-sm text-stone-200">Show health bars</span>
            <Switch
              data-testid="toggle-health-bars"
              checked={!!showHealthBars}
              onCheckedChange={setShowHealthBars}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg px-2.5 py-2 bg-black/20">
            <span className="text-sm text-stone-200">Show ghost trails</span>
            <Switch
              data-testid="toggle-ghost-trails"
              checked={!!showGhostTrails}
              onCheckedChange={setShowGhostTrails}
            />
          </label>
        </div>
      </Section>

      {/* Pin color filter */}
      {pins && pins.length > 0 && (
        <Section title="Filter Pins by Color">
          <PinColorFilter
            pins={pins}
            hidden={pinColorFilter}
            onToggle={(c) => {
              const next = new Set(pinColorFilter);
              if (next.has(c)) next.delete(c);
              else next.add(c);
              setPinColorFilter(next);
            }}
          />
        </Section>
      )}
      </div>
    </div>
  );
}

function PinColorFilter({ pins, hidden, onToggle }) {
  const counts = pins.reduce((acc, p) => {
    const c = p.color || "#D97706";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts);
  return (
    <div className="space-y-1.5">
      {entries.map(([c, n]) => {
        const off = hidden.has(c);
        return (
          <button
            key={c}
            data-testid={`pin-filter-${c}`}
            onClick={() => onToggle(c)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition ${
              off ? "opacity-40 hover:opacity-70" : "hover:bg-white/5"
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0"
              style={{ backgroundColor: c }}
            />
            <span className="text-sm text-stone-200 flex-1 text-left font-mono-cart">
              {c.toUpperCase()}
            </span>
            <span className="font-mono-cart text-[10px] text-stone-500">
              {n}
            </span>
            {off ? (
              <EyeOff className="w-3.5 h-3.5 text-stone-500" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-stone-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div className="font-mono-cart text-[10px] uppercase tracking-[0.18em] text-stone-500">
      {children}
    </div>
  );
}

function toolHelp(t) {
  const help = {
    pan: "Drag to pan. Scroll to zoom.",
    select:
      "Drag a rectangle around tokens/assets/grids to select them. Delete = remove all, Ctrl+D = duplicate all, Esc = clear selection.",
    brush: "Click and drag on the map to draw freehand strokes.",
    rect: "Click and drag to draw a rectangle.",
    circle: "Click and drag to draw a circle.",
    polygon: "Click to add points. Double-click or press Enter to finish.",
    text: "Click on the map to place a text label.",
    pin: "Click to drop a pin. Click an existing pin to open its details (pick icon, color, image, link a sub-map). Drag pins to reposition them.",
    token: "Click to drop an enemy token. Drag tokens to move them across the battlefield. Stroke size sets token diameter.",
    asset: "Click on the map to import a character portrait, token art, or other image. Drag to move.",
    grid: "Click and drag to place a grid. Stroke size sets the cell size. Drag the grid to reposition it.",
    "ai-redraw":
      "Drag to select an area, then describe what should appear there. Choose Nano Banana (image edit) or GPT Image 1 (generate).",
    "soft-erase": "Drag over brush strokes — anything inside the circle gets erased. Only affects freehand brush; use Delete Shape for everything else.",
    erase: "Click a shape, pin, token, asset, or label to delete it.",
  };
  return help[t] || "";
}
