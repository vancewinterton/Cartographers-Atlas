import { useState, useEffect } from "react";
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
import { Trash2, Swords, ImageIcon, Grid3x3 } from "lucide-react";

const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#F3F2F0", "#0B0A09"];

export default function ShapeEditPopover({ shape, onUpdate, onDelete, onClose }) {
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
                    Width <span className="text-stone-500 font-mono-cart">{Math.round(local.w)}px</span>
                  </span>
                }
              >
                <Slider
                  data-testid="shape-width"
                  min={20}
                  max={2000}
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
                  max={2000}
                  step={4}
                  value={[local.h || 100]}
                  onValueChange={(v) => patch({ h: v[0] })}
                />
              </Field>
            </>
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

          <div className="pt-6">
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
