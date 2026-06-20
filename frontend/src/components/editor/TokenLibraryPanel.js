import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { getLibrary, saveToken, removeToken } from "../../lib/tokenLibrary";
import { Library, X, Plus, Trash2, MapPin } from "lucide-react";

const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#A855F7", "#F59E0B", "#F3F2F0", "#0B0A09"];

const blankDraft = () => ({
  label: "",
  description: "",
  color: "#3B82F6",
  hp: 30,
  hpMax: 30,
  ac: 13,
  size: 40,
});

export default function TokenLibraryPanel({ onClose, onAddToken, prefill }) {
  const [list, setList] = useState(getLibrary());
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(blankDraft());

  useEffect(() => {
    if (prefill) {
      setDraft({ ...blankDraft(), ...prefill });
      setCreating(true);
    }
  }, [prefill]);

  const refresh = () => setList(getLibrary());

  const commitDraft = () => {
    if (!draft.label.trim()) return;
    saveToken({ ...draft, label: draft.label.trim() });
    refresh();
    setCreating(false);
    setDraft(blankDraft());
  };

  return (
    <div
      data-testid="token-library-panel"
      className="absolute left-20 top-20 z-40 glass rounded-2xl flex flex-col w-[320px] max-h-[80vh] shadow-2xl"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-amber-500" />
          <h2 className="font-display text-lg leading-tight">Token Library</h2>
        </div>
        <button
          data-testid="token-library-close"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-100 p-1 rounded hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.length === 0 && !creating && (
          <div className="text-center py-6 text-stone-500 text-sm">
            <Library className="w-7 h-7 mx-auto mb-2 opacity-30" />
            <div>No saved tokens yet.</div>
            <div className="text-[11px] mt-1 text-stone-600">
              Create one below to reuse it on any map.
            </div>
          </div>
        )}
        {list.map((t) => (
          <div
            key={t.id}
            data-testid={`library-token-${t.id}`}
            className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/5 px-2.5 py-2"
          >
            <span
              className="w-6 h-6 rounded-full ring-2 ring-black/40 shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-stone-100 truncate">{t.label}</div>
              <div className="text-[10px] text-stone-500 font-mono-cart truncate">
                {t.hp != null ? `${t.hp}/${t.hpMax} HP · AC ${t.ac}` : "no stats"}
                {t.description ? ` · ${t.description}` : ""}
              </div>
            </div>
            <button
              data-testid={`library-add-${t.id}`}
              onClick={() => onAddToken(t)}
              title="Add to current map"
              className="px-2 h-7 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 text-[10px] font-mono-cart uppercase tracking-wider flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" /> Add
            </button>
            <button
              data-testid={`library-delete-${t.id}`}
              onClick={() => {
                removeToken(t.id);
                refresh();
              }}
              className="text-stone-500 hover:text-red-400 p-1"
              title="Remove from library"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {creating && (
          <div className="rounded-lg bg-black/40 border border-amber-700/20 p-2.5 space-y-2">
            <Input
              data-testid="library-draft-name"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Token name (e.g. Aragorn)"
              className="bg-black/40 border-white/10 h-8 text-sm"
            />
            <Input
              data-testid="library-draft-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Description (optional)"
              className="bg-black/40 border-white/10 h-8 text-xs"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <LabeledNum label="HP" testid="library-draft-hp" value={draft.hp}
                onChange={(v) => setDraft({ ...draft, hp: v, hpMax: v })} />
              <LabeledNum label="Max" testid="library-draft-hpmax" value={draft.hpMax}
                onChange={(v) => setDraft({ ...draft, hpMax: v })} />
              <LabeledNum label="AC" testid="library-draft-ac" value={draft.ac}
                onChange={(v) => setDraft({ ...draft, ac: v })} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  data-testid={`library-draft-color-${c}`}
                  onClick={() => setDraft({ ...draft, color: c })}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border transition ${
                    draft.color === c
                      ? "border-amber-500 ring-2 ring-amber-500/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <Button
                data-testid="library-draft-save"
                size="sm"
                onClick={commitDraft}
                disabled={!draft.label.trim()}
                className="flex-1 h-8 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs"
              >
                Save token
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setDraft(blankDraft());
                }}
                className="text-stone-400 hover:bg-white/5 h-8 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {!creating && (
        <div className="p-3 border-t border-white/5">
          <Button
            data-testid="library-new-token"
            size="sm"
            onClick={() => setCreating(true)}
            className="w-full h-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 border border-blue-500/20 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New token
          </Button>
        </div>
      )}
    </div>
  );
}

function LabeledNum({ label, value, onChange, testid }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono-cart uppercase text-stone-500">{label}</span>
      <Input
        data-testid={testid}
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
        className="bg-black/40 border-white/10 h-7 text-[11px] px-1 text-center"
      />
    </label>
  );
}
