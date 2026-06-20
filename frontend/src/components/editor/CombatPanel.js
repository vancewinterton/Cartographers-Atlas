import { useMemo, useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dices,
  Swords,
  Plus,
  X,
  ChevronsRight,
  Heart,
  Shuffle,
  Trash2,
  Minus,
  Crosshair,
} from "lucide-react";

const DICE = [4, 6, 8, 10, 12, 20, 100];

export default function CombatPanel({ shapes, setShapes, onPushHistory, onClose }) {
  const tokens = useMemo(() => shapes.filter((s) => s.type === "token"), [shapes]);

  // Initiative state lives on tokens themselves (init field). Sort by descending init.
  const ordered = useMemo(() => {
    return [...tokens].sort((a, b) => (b.init ?? -999) - (a.init ?? -999));
  }, [tokens]);

  const [turnIdx, setTurnIdx] = useState(0);
  useEffect(() => {
    if (turnIdx >= ordered.length) setTurnIdx(0);
  }, [ordered.length, turnIdx]);

  const updateToken = (id, patch) => {
    setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const rollAll = () => {
    onPushHistory();
    setShapes((arr) =>
      arr.map((s) =>
        s.type === "token"
          ? { ...s, init: Math.floor(Math.random() * 20) + 1 + (s.initBonus || 0) }
          : s,
      ),
    );
    setTurnIdx(0);
  };

  const clearInit = () => {
    onPushHistory();
    setShapes((arr) =>
      arr.map((s) => (s.type === "token" ? { ...s, init: null } : s)),
    );
  };

  const next = () => setTurnIdx((i) => (ordered.length ? (i + 1) % ordered.length : 0));

  // Dice roller
  const [rollLog, setRollLog] = useState([]);
  const [qty, setQty] = useState(1);
  const [mod, setMod] = useState(0);
  const roll = (sides) => {
    const rolls = Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0) + Number(mod || 0);
    const entry = {
      id: Math.random().toString(36).slice(2),
      label: `${qty}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ""}`,
      rolls,
      total,
      mod: Number(mod || 0),
    };
    setRollLog((prev) => [entry, ...prev].slice(0, 12));
  };

  const applyDamage = (tokenId, amount) => {
    onPushHistory();
    setShapes((arr) =>
      arr.map((s) => {
        if (s.id !== tokenId) return s;
        const cur = s.hp ?? s.hpMax ?? 0;
        const next = Math.max(0, Math.min(s.hpMax ?? cur, cur - amount));
        return { ...s, hp: next };
      }),
    );
  };

  const [damageAmt, setDamageAmt] = useState({});

  return (
    <div
      data-testid="combat-panel"
      className="absolute left-20 top-20 z-30 glass rounded-2xl p-4 w-[300px] max-h-[80vh] flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-500" />
          Combat
        </h2>
        <button
          data-testid="combat-close"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-100 p-1 rounded hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Button
          data-testid="combat-roll-all"
          size="sm"
          onClick={rollAll}
          className="bg-amber-600 hover:bg-amber-500 text-stone-950 h-8 flex-1"
        >
          <Shuffle className="w-3.5 h-3.5 mr-1" /> Roll All
        </Button>
        <Button
          data-testid="combat-next"
          size="sm"
          variant="ghost"
          onClick={next}
          disabled={!ordered.length}
          className="text-stone-200 hover:bg-white/5 h-8"
        >
          <ChevronsRight className="w-3.5 h-3.5 mr-1" /> Next
        </Button>
        <button
          data-testid="combat-clear"
          onClick={clearInit}
          title="Clear initiative"
          className="text-stone-500 hover:text-red-400 p-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1 mb-3">
        {ordered.length === 0 && (
          <div className="text-stone-500 text-xs leading-relaxed py-4 text-center">
            Drop some enemy tokens on the map first, then come back here to roll initiative.
          </div>
        )}
        {ordered.map((t, idx) => {
          const isCurrent = idx === turnIdx && t.init != null;
          return (
            <div
              key={t.id}
              data-testid={`combat-row-${t.id}`}
              className={`rounded-lg p-2 transition ${
                isCurrent
                  ? "bg-amber-600/15 ring-1 ring-amber-700/40"
                  : "bg-black/30 hover:bg-black/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full ring-1 ring-black shrink-0"
                  style={{ backgroundColor: t.color || "#EF4444" }}
                />
                <Input
                  data-testid={`combat-name-${t.id}`}
                  value={t.label || ""}
                  onChange={(e) => updateToken(t.id, { label: e.target.value })}
                  placeholder="Unnamed"
                  className="bg-transparent border-0 h-7 px-1 text-sm focus-visible:ring-0 flex-1 min-w-0"
                />
                {t.hp != null && t.hpMax != null && (
                  <span className="text-[10px] font-mono-cart text-stone-400 shrink-0 flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5" /> {t.hp}/{t.hpMax}
                  </span>
                )}
                <Input
                  data-testid={`combat-init-${t.id}`}
                  type="number"
                  value={t.init ?? ""}
                  onChange={(e) =>
                    updateToken(t.id, {
                      init: e.target.value === "" ? null : parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="—"
                  className="bg-black/40 border-white/10 h-7 w-12 text-xs px-1.5 text-center"
                />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Input
                  data-testid={`combat-dmg-${t.id}`}
                  type="number"
                  value={damageAmt[t.id] ?? ""}
                  onChange={(e) =>
                    setDamageAmt((m) => ({ ...m, [t.id]: e.target.value }))
                  }
                  placeholder="dmg"
                  className="bg-black/30 border-white/10 h-6 w-14 text-[11px] px-1.5 text-center"
                />
                <button
                  data-testid={`combat-apply-dmg-${t.id}`}
                  onClick={() => {
                    const v = parseInt(damageAmt[t.id] || "0", 10);
                    if (!v) return;
                    applyDamage(t.id, v);
                  }}
                  className="px-2 h-6 rounded-md bg-red-600/15 hover:bg-red-600/30 text-red-300 text-[10px] font-mono-cart uppercase tracking-wider transition"
                >
                  −HP
                </button>
                <button
                  data-testid={`combat-apply-heal-${t.id}`}
                  onClick={() => {
                    const v = parseInt(damageAmt[t.id] || "0", 10);
                    if (!v) return;
                    applyDamage(t.id, -v);
                  }}
                  className="px-2 h-6 rounded-md bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-mono-cart uppercase tracking-wider transition"
                >
                  +HP
                </button>
                {rollLog[0] && (
                  <button
                    data-testid={`combat-apply-roll-${t.id}`}
                    onClick={() => applyDamage(t.id, rollLog[0].total)}
                    title={`Apply last roll (${rollLog[0].total}) as damage`}
                    className="px-1.5 h-6 rounded-md bg-amber-600/15 hover:bg-amber-600/30 text-amber-400 text-[10px] font-mono-cart uppercase tracking-wider transition flex items-center gap-1"
                  >
                    <Crosshair className="w-2.5 h-2.5" />
                    {rollLog[0].total}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dice */}
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Dices className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Dice
          </span>
          <div className="flex-1" />
          <span className="font-mono-cart text-[10px] text-stone-500">qty</span>
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="text-stone-400 hover:text-amber-500"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs text-stone-200 w-4 text-center">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            className="text-stone-400 hover:text-amber-500"
          >
            <Plus className="w-3 h-3" />
          </button>
          <Input
            data-testid="dice-mod"
            type="number"
            value={mod}
            onChange={(e) => setMod(e.target.value)}
            placeholder="±0"
            className="bg-black/40 border-white/10 h-6 w-12 text-xs ml-1 px-1.5 text-center"
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {DICE.map((d) => (
            <button
              key={d}
              data-testid={`roll-d${d}`}
              onClick={() => roll(d)}
              className="px-1 py-1.5 rounded-lg bg-black/30 hover:bg-amber-600/10 hover:text-amber-500 text-stone-200 text-xs font-mono-cart transition"
            >
              d{d}
            </button>
          ))}
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {rollLog.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between text-xs px-2 py-1 bg-black/20 rounded-md"
            >
              <span className="font-mono-cart text-stone-500">{r.label}</span>
              <span className="font-mono-cart text-stone-400 text-[10px] flex-1 mx-2 truncate">
                [{r.rolls.join(", ")}]
              </span>
              <span className="font-mono-cart text-amber-500 font-bold">{r.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
