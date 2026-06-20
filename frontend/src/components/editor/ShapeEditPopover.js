import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Trash2, Swords, ImageIcon, Grid3x3, Copy, Eye, EyeOff } from "lucide-react";

const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#F3F2F0", "#0B0A09"];

export default function ShapeEditPopover({ shape, onUpdate, onDelete, onDuplicate, onClose }) {
  const [local, setLocal] = useState(shape);
  useEffect(() => setLocal(shape), [shape?.id]);
  if (!shape) return null;

  const patch = (p) => {
    const next = { ...local, ...p };
    setLocal(next);
    onUpdate(p);
  };

  const isToken = shape.type === "token";
  const isAsset = shape.type === "asset";
  const isGrid = shape.type === "grid";

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        data-testid="shape-edit-sheet"
        side="right"
        className="bg-[#1E1B18] border-white/10 text-stone-100 w-[400px] sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-3xl flex items-center gap-2">
            {isToken && <Swords className="w-5 h-5 text-red-400" />}
            {isAsset && <ImageIcon className="w-5 h-5 text-amber-500" />}
            {isGrid && <Grid3x3 className="w-5 h-5 text-amber-500" />}
            {isToken ? "Token" : isAsset ? "Asset" : "Grid"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {isToken && (
            <>
              <Field label="Name">
                <Input
                  data-testid="shape-token-name"
                  value={local.label || ""}
                  onChange={(e) => patch({ label: e.target.value })}
                  placeholder="Goblin Captain"
                  className="bg-black/40 border-white/10"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="HP">
                  <Input
                    data-testid="shape-token-hp"
                    type="number"
                    value={local.hp ?? ""}
                    onChange={(e) =>
                      patch({ hp: e.target.value === "" ? null : parseInt(e.target.value, 10) })
                    }
                    className="bg-black/40 border-white/10"
                  />
                </Field>
                <Field label="Max HP">
                  <Input
                    data-testid="shape-token-hpmax"
                    type="number"
                    value={local.hpMax ?? ""}
                    onChange={(e) =>
                      patch({ hpMax: e.target.value === "" ? null : parseInt(e.target.value, 10) })
                    }
                    className="bg-black/40 border-white/10"
                  />
                </Field>
                <Field label="AC">
                  <Input
                    data-testid="shape-token-ac"
                    type="number"
                    value={local.ac ?? ""}
                    onChange={(e) =>
                      patch({ ac: e.target.value === "" ? null : parseInt(e.target.value, 10) })
                    }
                    className="bg-black/40 border-white/10"
                  />
                </Field>
              </div>
              <Field label="Color">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      data-testid={`shape-color-${c}`}
                      onClick={() => patch({ color: c })}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full border transition ${
                        local.color === c
                          ? "border-amber-500 ring-2 ring-amber-500/40"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {isToken && (
            <Field
              label={
                <span>
                  Size <span className="text-stone-500 font-mono-cart">{Math.round(local.size)}px</span>
                </span>
              }
            >
              <Slider
                data-testid="shape-token-size"
                min={4}
                max={200}
                step={1}
                value={[local.size || 40]}
                onValueChange={(v) => patch({ size: v[0] })}
              />
            </Field>
          )}

          {(isAsset || isGrid) && (
            <>
              <Field
                label={
                  <span>
                    Scale{" "}
                    <span className="text-stone-500 font-mono-cart">
                      W & H equally
                    </span>
                  </span>
                }
              >
                <div className="flex items-center gap-2">
                  <Button
                    data-testid="shape-scale-down"
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ w: (local.w || 100) * 0.8, h: (local.h || 100) * 0.8 })}
                    className="text-stone-300 hover:bg-white/5"
                  >
                    −20%
                  </Button>
                  <Slider
                    data-testid="shape-scale"
                    min={50}
                    max={3000}
                    step={4}
                    value={[Math.max(local.w || 100, local.h || 100)]}
                    onValueChange={(v) => {
                      const target = v[0];
                      const cur = Math.max(local.w || 100, local.h || 100);
                      const ratio = target / cur;
                      patch({ w: (local.w || 100) * ratio, h: (local.h || 100) * ratio });
                    }}
                    className="flex-1"
                  />
                  <Button
                    data-testid="shape-scale-up"
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ w: (local.w || 100) * 1.25, h: (local.h || 100) * 1.25 })}
                    className="text-stone-300 hover:bg-white/5"
                  >
                    +25%
                  </Button>
                </div>
              </Field>

              <Field
                label={
                  <span>
                    Width <span className="text-stone-500 font-mono-cart">{Math.round(local.w)}px</span>
                  </span>
                }
              >
                <Slider
                  data-testid="shape-width"
                  min={20}
                  max={3000}
                  step={4}
                  value={[local.w || 100]}
                  onValueChange={(v) => patch({ w: v[0] })}
                />
              </Field>
              <Field
                label={
                  <span>
                    Height <span className="text-stone-500 font-mono-cart">{Math.round(local.h)}px</span>
                  </span>
                }
              >
                <Slider
                  data-testid="shape-height"
                  min={20}
                  max={3000}
                  step={4}
                  value={[local.h || 100]}
                  onValueChange={(v) => patch({ h: v[0] })}
                />
              </Field>
            </>
          )}

          {isAsset && (
            <Field label="Crop">
              <CropControls
                shape={local}
                onChange={(cropRect) => patch({ cropRect })}
              />
            </Field>
          )}

          {isGrid && (
            <>
              <Field
                label={
                  <span>
                    Cell size{" "}
                    <span className="text-stone-500 font-mono-cart">
                      {Math.round(local.cellSize || 40)}px
                    </span>
                  </span>
                }
              >
                <Slider
                  data-testid="shape-grid-cell"
                  min={8}
                  max={200}
                  step={1}
                  value={[local.cellSize || 40]}
                  onValueChange={(v) => patch({ cellSize: v[0] })}
                />
              </Field>
              <Field label="Color">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => patch({ color: c })}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full border transition ${
                        local.color === c
                          ? "border-amber-500 ring-2 ring-amber-500/40"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          <div className="pt-6 space-y-2">
            <button
              data-testid="shape-hidden-toggle"
              onClick={() => patch({ hidden: !local.hidden })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition ${
                local.hidden
                  ? "bg-amber-600/10 border-amber-700/40 text-amber-500"
                  : "bg-black/30 border-white/10 text-stone-200 hover:bg-white/5"
              }`}
            >
              {local.hidden ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">
                  {local.hidden ? "Hidden from players" : "Visible to players"}
                </div>
                <div className="text-[10px] font-mono-cart uppercase tracking-wider opacity-70 mt-0.5">
                  {local.hidden
                    ? "Faded for you, invisible on share link"
                    : "Everyone with the link sees this"}
                </div>
              </div>
            </button>
            {onDuplicate && (
              <Button
                data-testid="shape-duplicate-btn"
                variant="ghost"
                onClick={onDuplicate}
                className="text-amber-500 hover:bg-amber-500/10 w-full justify-start"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate {isToken ? "token" : isAsset ? "asset" : "grid"}
              </Button>
            )}
            <Button
              data-testid="shape-delete-btn"
              variant="ghost"
              onClick={onDelete}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full justify-start"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {isToken ? "token" : isAsset ? "asset" : "grid"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500 block mb-2">
        {label}
      </Label>
      {children}
    </div>
  );
}

// Crop controls — drag a rectangle on the original image to set cropRect (normalized 0..1).
function CropControls({ shape, onChange }) {
  const [editing, setEditing] = useState(false);
  const containerRef = useState(null);
  const crop = shape.cropRect || { x: 0, y: 0, w: 1, h: 1 };
  const dragRef = useState({ current: null });

  if (!editing) {
    const isCropped = crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1;
    return (
      <div className="flex items-center gap-2">
        <Button
          data-testid="asset-crop-open"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          className="bg-black/30 border border-white/10 hover:bg-white/5 text-stone-200"
        >
          {isCropped ? "Edit crop" : "Crop image…"}
        </Button>
        {isCropped && (
          <Button
            data-testid="asset-crop-reset"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ x: 0, y: 0, w: 1, h: 1 })}
            className="text-stone-400 hover:bg-white/5"
          >
            Reset
          </Button>
        )}
      </div>
    );
  }

  return (
    <CropEditor
      src={shape.src}
      initialCrop={crop}
      onApply={(c) => {
        onChange(c);
        setEditing(false);
      }}
      onCancel={() => setEditing(false)}
    />
  );
}

function CropEditor({ src, initialCrop, onApply, onCancel }) {
  const wrapRef = useState(null);
  const [c, setC] = useState(initialCrop);
  const stateRef = useState({ current: null });

  const onMouseDown = (e) => {
    const target = e.currentTarget.getBoundingClientRect();
    const startX = (e.clientX - target.left) / target.width;
    const startY = (e.clientY - target.top) / target.height;
    const onMove = (ev) => {
      const nx = Math.min(1, Math.max(0, (ev.clientX - target.left) / target.width));
      const ny = Math.min(1, Math.max(0, (ev.clientY - target.top) / target.height));
      setC({
        x: Math.min(startX, nx),
        y: Math.min(startY, ny),
        w: Math.abs(nx - startX),
        h: Math.abs(ny - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="space-y-2">
      <div
        className="relative w-full rounded-lg overflow-hidden bg-black/40 border border-white/10 cursor-crosshair select-none"
        onMouseDown={onMouseDown}
        data-testid="crop-editor"
      >
        <img src={src} alt="crop-source" className="w-full block pointer-events-none" draggable={false} />
        <div
          className="absolute border-2 border-amber-500 bg-amber-500/10 pointer-events-none"
          style={{
            left: `${c.x * 100}%`,
            top: `${c.y * 100}%`,
            width: `${c.w * 100}%`,
            height: `${c.h * 100}%`,
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-stone-400 hover:bg-white/5"
          data-testid="crop-cancel"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onApply(c.w < 0.02 || c.h < 0.02 ? { x: 0, y: 0, w: 1, h: 1 } : c)
          }
          className="bg-amber-600 hover:bg-amber-500 text-stone-950"
          data-testid="crop-apply"
        >
          Apply crop
        </Button>
      </div>
    </div>
  );
}
