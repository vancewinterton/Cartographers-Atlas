import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Trash2, Link2, Plus, ArrowUpRight } from "lucide-react";
import { PIN_ICONS, getPinIcon } from "./pinIcons";

const PIN_COLORS = ["#D97706", "#EF4444", "#10B981", "#3B82F6", "#A855F7", "#F3F2F0"];

export default function NestedMapSheet({
  open,
  onOpenChange,
  pin,
  allMaps,
  onUpdate,
  onDelete,
  onCreateLinkedMap,
  onOpenMap,
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [newMapName, setNewMapName] = useState("");

  useEffect(() => {
    if (pin) {
      setLabel(pin.label || "");
      setDescription(pin.description || "");
      setNewMapName("");
    }
  }, [pin]);

  if (!pin) return null;

  const PinIconC = getPinIcon(pin.icon);
  const linkedMap = pin.linked_map_id
    ? allMaps.find((m) => m.id === pin.linked_map_id)
    : null;

  const commit = () => {
    onUpdate({ label, description });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="nested-map-sheet"
        side="right"
        className="bg-[#1E1B18] border-white/10 text-stone-100 w-[420px] sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-3xl flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full inline-flex items-center justify-center"
              style={{ backgroundColor: pin.color || "#D97706" }}
            >
              <PinIconC className="w-4 h-4 text-stone-950" strokeWidth={2} />
            </span>
            Pin Details
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Icon
            </Label>
            <div className="grid grid-cols-6 gap-1.5 mt-2">
              {PIN_ICONS.map((p) => {
                const Ic = p.Icon;
                const active = (pin.icon || "pin") === p.id;
                return (
                  <button
                    key={p.id}
                    data-testid={`pin-icon-${p.id}`}
                    title={p.label}
                    onClick={() => onUpdate({ icon: p.id })}
                    className={`aspect-square rounded-lg flex items-center justify-center transition ${
                      active
                        ? "bg-amber-600/15 ring-1 ring-amber-600/40 text-amber-500"
                        : "bg-black/30 text-stone-400 hover:bg-white/5 hover:text-stone-100"
                    }`}
                  >
                    <Ic className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Color
            </Label>
            <div className="flex gap-2 mt-2">
              {PIN_COLORS.map((c) => (
                <button
                  key={c}
                  data-testid={`pin-color-${c}`}
                  onClick={() => onUpdate({ color: c })}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full border transition ${
                    pin.color === c
                      ? "border-amber-500 ring-2 ring-amber-500/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="h-px bg-white/5" />

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Label
            </Label>
            <Input
              data-testid="pin-label-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commit}
              className="bg-black/40 border-white/10 mt-2"
            />
          </div>

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Description / Notes
            </Label>
            <Textarea
              data-testid="pin-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commit}
              placeholder="Lore, NPCs, encounters…"
              className="bg-black/40 border-white/10 mt-2 min-h-[100px]"
            />
          </div>

          <div className="h-px bg-white/5" />

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500 flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              Linked Sub-Map
            </Label>

            {linkedMap ? (
              <div
                data-testid="linked-map-card"
                className="mt-3 rounded-xl border border-amber-700/30 bg-amber-600/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl text-amber-500">
                      {linkedMap.name}
                    </div>
                    <div className="font-mono-cart text-[10px] uppercase tracking-wider text-stone-500 mt-1">
                      Linked Map
                    </div>
                  </div>
                  <Button
                    data-testid="open-linked-map"
                    onClick={() => onOpenMap(linkedMap.id)}
                    className="bg-amber-600 hover:bg-amber-500 text-stone-950"
                  >
                    Open <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-stone-500 leading-relaxed">
                  Create a new sub-map for this location. Clicking the pin will jump
                  to it — perfect for dungeons inside a city, cities on a continent, etc.
                </p>
                <div className="flex gap-2">
                  <Input
                    data-testid="new-submap-name"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder={`${label || "Sub"} Map`}
                    className="bg-black/40 border-white/10"
                  />
                  <Button
                    data-testid="create-submap-btn"
                    onClick={() => onCreateLinkedMap(newMapName)}
                    className="bg-amber-600 hover:bg-amber-500 text-stone-950 shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Create
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6">
            <Button
              data-testid="delete-pin-btn"
              variant="ghost"
              onClick={onDelete}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full justify-start"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Pin
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
