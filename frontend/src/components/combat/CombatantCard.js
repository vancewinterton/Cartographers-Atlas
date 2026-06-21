import { useState } from "react";
import { useCombat, executeAttack, statusOf, parseDice } from "./CombatContext";
import { Input } from "../ui/input";
import {
  Heart,
  Shield,
  Copy,
  X,
  Swords,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Dice6,
  Brain,
  Crosshair,
} from "lucide-react";

const STATUS_BADGE = {
  Alive: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30",
  Bloodied: "bg-orange-600/20 text-orange-300 border-orange-500/30",
  Dead: "bg-stone-700/40 text-stone-400 border-stone-600/40 line-through",
};

export default function CombatantCard({ combatant, isCurrent, position, allCombatants = [], onFocusToken }) {
  const c = combatant;
  const { dispatch, state, presetConditions } = useCombat();
  const [expanded, setExpanded] = useState(false);
  const [hpInput, setHpInput] = useState("");
  const [showConditions, setShowConditions] = useState(false);
  const [customCondition, setCustomCondition] = useState("");
  const [lastRoll, setLastRoll] = useState(null); // { attackName, results: [...] }

  const status = statusOf(c);
  const hpPct = Math.max(
    0,
    Math.min(100, Math.round((c.currentHp / Math.max(1, c.maxHp)) * 100))
  );
  const barColor =
    status === "Dead"
      ? "bg-stone-600"
      : status === "Bloodied"
      ? "bg-orange-500"
      : "bg-emerald-500";

  const update = (patch) =>
    dispatch({ type: "UPDATE_COMBATANT", id: c.id, patch });
  const modHp = (delta) => dispatch({ type: "MODIFY_HP", id: c.id, delta });
  const setHp = (value) => dispatch({ type: "SET_HP", id: c.id, value });

  const rollAttack = (attack) => {
    const results = executeAttack(attack);
    // Persist the most recent roll on the card for prominent display
    setLastRoll({ attackName: attack.name || "Attack", attack, results });
    let lines = [`${c.name} → ${attack.name || "Attack"}`];
    results.forEach((r, i) => {
      const tag = results.length > 1 ? `[${i + 1}/${results.length}] ` : "";
      const sign = r.hitBonus >= 0 ? `+${r.hitBonus}` : `${r.hitBonus}`;
      let line = `${tag}🎯 d20=${r.hitRoll} ${sign} = ${r.hitTotal}`;
      if (r.isCrit) line += "  ✨CRIT";
      else if (r.isFumble) line += "  💢FUMBLE";
      lines.push(line);
      if (r.damage) {
        const dmgFormula = r.isCrit
          ? `${parseDice(attack.damageDice).count * 2}d${parseDice(attack.damageDice).sides}`
          : attack.damageDice;
        const modPart =
          r.damage.modifier > 0
            ? `+${r.damage.modifier}`
            : r.damage.modifier < 0
            ? `${r.damage.modifier}`
            : "";
        const rollsPart = r.damage.critRolls
          ? `[${r.damage.rolls.join(",")} | ${r.damage.critRolls.join(",")}]`
          : `[${r.damage.rolls.join(",")}]`;
        lines.push(`   ⚔ ${dmgFormula}${modPart} ${rollsPart} = ${r.damage.total}`);
      }
    });
    // Push each line as its own log entry for readability
    lines.forEach((text, i) => {
      dispatch({
        type: "LOG_ATTACK",
        text,
        entryType: i === 0 ? "attack" : text.trim().startsWith("⚔") ? "damage" : "attack",
      });
    });
  };

  return (
    <div
      data-testid={`combatant-card-${c.id}`}
      className={`rounded-xl p-2.5 transition ${
        isCurrent
          ? "bg-amber-600/15 ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/10"
          : status === "Dead"
          ? "bg-black/40 opacity-60"
          : "bg-black/30 hover:bg-black/40"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isCurrent && (
          <span
            className="text-amber-400 text-xs font-mono-cart shrink-0"
            data-testid="active-indicator"
            title="Current turn"
          >
            ▶
          </span>
        )}
        <button
          type="button"
          data-testid={`focus-token-${c.id}`}
          onClick={() => {
            if (c.sourceTokenId && onFocusToken) onFocusToken(c.sourceTokenId);
          }}
          disabled={!c.sourceTokenId || !onFocusToken}
          title={
            c.sourceTokenId
              ? "Find this token on the map"
              : c.kind === "pc"
              ? "Player Character"
              : "Enemy"
          }
          className={`w-5 h-5 rounded-full ring-1 ring-black/40 shrink-0 relative ${
            c.sourceTokenId && onFocusToken ? "cursor-pointer hover:ring-2 hover:ring-amber-400" : "cursor-default"
          }`}
          style={{ backgroundColor: c.color }}
        >
          {c.kind === "pc" && (
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white pointer-events-none">
              P
            </span>
          )}
        </button>
        <Input
          data-testid={`name-${c.id}`}
          value={c.name}
          onChange={(e) => update({ name: e.target.value })}
          className="bg-transparent border-0 h-7 px-1 text-sm font-semibold focus-visible:ring-0 flex-1 min-w-0"
        />
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono-cart uppercase tracking-wider border ${STATUS_BADGE[status]}`}
          data-testid={`status-${c.id}`}
        >
          {status}
        </span>
        <button
          onClick={() => dispatch({ type: "DUPLICATE_COMBATANT", id: c.id })}
          className="text-stone-500 hover:text-amber-400 p-1"
          title="Duplicate"
          data-testid={`duplicate-${c.id}`}
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={() => dispatch({ type: "REMOVE_COMBATANT", id: c.id })}
          className="text-stone-500 hover:text-red-400 p-1"
          title="Remove"
          data-testid={`remove-${c.id}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* HP bar */}
      <div className="mt-1.5 relative h-4 rounded-md bg-black/40 overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${hpPct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono-cart text-white drop-shadow">
          <Heart className="w-2.5 h-2.5 mr-1" />
          <span data-testid={`hp-${c.id}`}>
            {c.currentHp} / {c.maxHp}
          </span>
        </div>
      </div>

      {/* Stat row */}
      <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono-cart">
        <div className="flex items-center gap-1 text-stone-400">
          <Shield className="w-3 h-3 text-blue-400" />
          <span>AC</span>
          <Input
            data-testid={`ac-${c.id}`}
            type="number"
            value={c.ac}
            onChange={(e) => update({ ac: parseInt(e.target.value, 10) || 0 })}
            className="bg-black/40 border-white/10 h-6 w-10 text-[10px] px-1 text-center"
          />
        </div>
        <div className="flex items-center gap-1 text-stone-400">
          <Dice6 className="w-3 h-3 text-purple-400" />
          <span>Init+</span>
          <Input
            data-testid={`init-mod-${c.id}`}
            type="number"
            value={c.initiativeMod}
            onChange={(e) =>
              update({ initiativeMod: parseInt(e.target.value, 10) || 0 })
            }
            className="bg-black/40 border-white/10 h-6 w-10 text-[10px] px-1 text-center"
          />
        </div>
        <div className="flex items-center gap-1 text-stone-400">
          <span className="text-amber-400">⚡</span>
          <Input
            data-testid={`init-roll-${c.id}`}
            type="number"
            value={c.initiativeRoll ?? ""}
            placeholder="—"
            onChange={(e) =>
              update({
                initiativeRoll:
                  e.target.value === "" ? null : parseInt(e.target.value, 10),
              })
            }
            className="bg-black/40 border-amber-700/30 h-6 w-10 text-[10px] px-1 text-center font-bold text-amber-300"
            title="Initiative result"
          />
          <button
            onClick={() => dispatch({ type: "ROLL_ONE_INIT", id: c.id })}
            className="text-stone-400 hover:text-amber-400 transition"
            title="Roll initiative"
            data-testid={`roll-init-${c.id}`}
          >
            🎲
          </button>
        </div>
        {state.settings.trackConcentration && (
          <button
            data-testid={`concentration-${c.id}`}
            onClick={() => dispatch({ type: "TOGGLE_CONCENTRATION", id: c.id })}
            className={`ml-auto flex items-center gap-1 px-1.5 h-6 rounded transition ${
              c.concentration
                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/40"
                : "text-stone-500 hover:text-purple-300"
            }`}
            title="Concentration"
          >
            <Brain className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* HP Controls */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <button
          data-testid={`hp-minus-5-${c.id}`}
          onClick={() => modHp(-5)}
          className="px-1.5 h-6 rounded bg-red-600/20 hover:bg-red-600/40 text-red-200 text-[10px] font-mono-cart"
        >
          −5
        </button>
        <button
          data-testid={`hp-minus-1-${c.id}`}
          onClick={() => modHp(-1)}
          className="px-1.5 h-6 rounded bg-red-600/15 hover:bg-red-600/30 text-red-200 text-[10px] font-mono-cart"
        >
          −1
        </button>
        <button
          data-testid={`hp-plus-1-${c.id}`}
          onClick={() => modHp(1)}
          className="px-1.5 h-6 rounded bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-200 text-[10px] font-mono-cart"
        >
          +1
        </button>
        <button
          data-testid={`hp-plus-5-${c.id}`}
          onClick={() => modHp(5)}
          className="px-1.5 h-6 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-200 text-[10px] font-mono-cart"
        >
          +5
        </button>
        <button
          data-testid={`hp-full-${c.id}`}
          onClick={() => setHp(c.maxHp)}
          className="px-1.5 h-6 rounded bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-100 text-[10px] font-mono-cart uppercase tracking-wider"
          title="Heal to full"
        >
          Full
        </button>
        <Input
          data-testid={`hp-set-input-${c.id}`}
          type="number"
          value={hpInput}
          placeholder="set"
          onChange={(e) => setHpInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hpInput !== "") {
              setHp(hpInput);
              setHpInput("");
            }
          }}
          className="bg-black/40 border-white/10 h-6 w-14 text-[10px] px-1.5 text-center"
        />
        <button
          data-testid={`hp-set-apply-${c.id}`}
          onClick={() => {
            if (hpInput === "") return;
            setHp(hpInput);
            setHpInput("");
          }}
          className="px-1.5 h-6 rounded bg-stone-700/40 hover:bg-stone-700/60 text-stone-200 text-[10px] font-mono-cart uppercase tracking-wider"
        >
          Set
        </button>
        <Input
          data-testid={`max-hp-${c.id}`}
          type="number"
          value={c.maxHp}
          onChange={(e) =>
            update({ maxHp: Math.max(1, parseInt(e.target.value, 10) || 1) })
          }
          className="bg-black/30 border-white/10 h-6 w-12 text-[10px] px-1 text-center ml-auto"
          title="Max HP"
        />
      </div>

      {/* Conditions */}
      {(c.conditions.length > 0 || showConditions) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {c.conditions.map((cond) => (
            <button
              key={cond}
              data-testid={`condition-tag-${c.id}-${cond}`}
              onClick={() =>
                dispatch({ type: "TOGGLE_CONDITION", id: c.id, condition: cond })
              }
              className="px-1.5 py-0.5 rounded bg-purple-600/20 hover:bg-red-600/30 text-purple-200 text-[9px] font-mono-cart uppercase tracking-wider"
              title="Click to remove"
            >
              {cond} ×
            </button>
          ))}
        </div>
      )}

      {/* Footer toggles */}
      <div className="flex items-center gap-1 mt-2">
        <button
          data-testid={`toggle-conditions-${c.id}`}
          onClick={() => setShowConditions((v) => !v)}
          className="px-1.5 h-6 rounded text-stone-400 hover:text-purple-300 text-[10px] font-mono-cart uppercase tracking-wider"
        >
          {showConditions ? "Hide" : "Conditions"}
        </button>
        <button
          data-testid={`toggle-attacks-${c.id}`}
          onClick={() => setExpanded((v) => !v)}
          className="px-1.5 h-6 rounded text-stone-400 hover:text-amber-300 text-[10px] font-mono-cart uppercase tracking-wider flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Attacks ({c.attacks.length})
        </button>
      </div>

      {showConditions && (
        <div
          data-testid={`conditions-panel-${c.id}`}
          className="mt-2 rounded-lg bg-black/30 border border-purple-700/20 p-2"
        >
          <div className="flex flex-wrap gap-1 mb-2">
            {presetConditions.map((cond) => {
              const active = c.conditions.includes(cond);
              return (
                <button
                  key={cond}
                  data-testid={`condition-preset-${c.id}-${cond}`}
                  onClick={() =>
                    dispatch({ type: "TOGGLE_CONDITION", id: c.id, condition: cond })
                  }
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono-cart uppercase tracking-wider transition ${
                    active
                      ? "bg-purple-600/30 text-purple-200 ring-1 ring-purple-400/40"
                      : "bg-black/30 text-stone-400 hover:bg-purple-600/15"
                  }`}
                >
                  {cond}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <Input
              value={customCondition}
              onChange={(e) => setCustomCondition(e.target.value)}
              placeholder="Custom condition…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customCondition.trim()) {
                  dispatch({
                    type: "TOGGLE_CONDITION",
                    id: c.id,
                    condition: customCondition.trim(),
                  });
                  setCustomCondition("");
                }
              }}
              className="bg-black/40 border-white/10 h-6 text-[10px] px-1.5 flex-1"
              data-testid={`custom-condition-input-${c.id}`}
            />
            <button
              data-testid={`custom-condition-add-${c.id}`}
              onClick={() => {
                if (!customCondition.trim()) return;
                dispatch({
                  type: "TOGGLE_CONDITION",
                  id: c.id,
                  condition: customCondition.trim(),
                });
                setCustomCondition("");
              }}
              className="px-1.5 h-6 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 text-[10px]"
            >
              +
            </button>
          </div>
        </div>
      )}

      {lastRoll && (
        <AttackResultBlock
          lastRoll={lastRoll}
          combatantId={c.id}
          attackerName={c.name}
          allCombatants={allCombatants}
          dispatch={dispatch}
          onClear={() => setLastRoll(null)}
        />
      )}

      {expanded && (
        <div
          className="mt-2 space-y-1.5 rounded-lg bg-black/30 border border-amber-700/20 p-2"
          data-testid={`attacks-panel-${c.id}`}
        >
          {c.attacks.length === 0 && (
            <div className="text-[10px] text-stone-500 text-center py-1">
              No attacks. Add one below.
            </div>
          )}
          {c.attacks.map((a) => (
            <AttackRow key={a.id} combatantId={c.id} attack={a} onRoll={rollAttack} />
          ))}
          <button
            onClick={() => dispatch({ type: "ADD_ATTACK", id: c.id })}
            className="w-full text-[10px] font-mono-cart uppercase tracking-wider text-amber-400 hover:text-amber-300 py-1 rounded border border-dashed border-amber-700/30 hover:border-amber-500/50 transition"
            data-testid={`add-attack-${c.id}`}
          >
            <Plus className="w-3 h-3 inline" /> Add Attack
          </button>
        </div>
      )}
    </div>
  );
}

function AttackResultBlock({
  lastRoll,
  combatantId,
  attackerName,
  allCombatants = [],
  dispatch,
  onClear,
}) {
  const { state } = useCombat();
  const { attackName, results } = lastRoll;
  const totalHits = results.filter((r) => !r.isFumble).length;
  const totalDamage = results.reduce(
    (sum, r) => sum + (r.damage?.total || 0),
    0
  );
  // Apply-damage picker state (per-row + total)
  const [targetId, setTargetId] = useState("");
  const [applied, setApplied] = useState(null); // { targetId, amount }
  const validTargets = allCombatants.filter(
    (t) => t.id !== combatantId && t.currentHp > 0
  );
  const applyDamage = (amount) => {
    if (!targetId || amount <= 0) return;
    dispatch({
      type: "MODIFY_HP",
      id: targetId,
      delta: -Math.abs(amount),
    });
    const tgt = allCombatants.find((c) => c.id === targetId);
    dispatch({
      type: "LOG_ATTACK",
      text: `💥 ${attackerName} hits ${tgt?.name || "target"} for ${amount} damage.`,
      entryType: "damage",
    });
    setApplied({ targetId, amount });
    setTimeout(() => setApplied(null), 1500);
  };
  return (
    <div
      data-testid={`attack-result-${combatantId}`}
      className="mt-2 rounded-lg bg-gradient-to-br from-amber-950/40 to-stone-950/50 border border-amber-500/30 p-2 space-y-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Swords className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-mono-cart uppercase tracking-widest text-amber-300 font-bold">
            {attackName}
          </span>
          {results.length > 1 && (
            <span className="text-[9px] text-stone-400 font-mono-cart">
              ×{results.length}
            </span>
          )}
        </div>
        <button
          data-testid={`clear-attack-result-${combatantId}`}
          onClick={onClear}
          className="text-stone-500 hover:text-stone-200 text-[10px] leading-none"
          title="Clear result"
        >
          ✕
        </button>
      </div>
      <div className="space-y-0.5 font-mono-cart text-[10px]">
        {results.map((r, i) => (
          <div
            key={i}
            data-testid={`attack-line-${combatantId}-${i}`}
            className="flex items-center gap-1 flex-wrap"
          >
            {results.length > 1 && (
              <span className="text-stone-500 w-6">
                {i + 1}/{results.length}
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 rounded ${
                r.isCrit
                  ? "bg-amber-500/30 text-amber-200 font-bold"
                  : r.isFumble
                  ? "bg-red-700/30 text-red-300"
                  : "bg-blue-500/20 text-blue-200"
              }`}
            >
              🎯 d20={r.hitRoll}
              {r.hitBonus !== 0
                ? r.hitBonus > 0
                  ? `+${r.hitBonus}`
                  : `${r.hitBonus}`
                : ""}{" "}
              = <span className="font-bold">{r.hitTotal}</span>
              {r.isCrit && " ✨CRIT"}
              {r.isFumble && " 💢"}
            </span>
            {r.damage ? (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-200">
                ⚔ [{r.damage.rolls.join(",")}
                {r.damage.critRolls
                  ? ` | ${r.damage.critRolls.join(",")}`
                  : ""}
                ]
                {r.damage.modifier !== 0
                  ? r.damage.modifier > 0
                    ? `+${r.damage.modifier}`
                    : `${r.damage.modifier}`
                  : ""}{" "}
                = <span className="font-bold">{r.damage.total}</span>
              </span>
            ) : (
              <span className="text-stone-500 text-[9px]">no damage</span>
            )}
            {/* Per-attack apply button */}
            {r.damage && targetId && (
              <button
                data-testid={`apply-line-${combatantId}-${i}`}
                onClick={() => applyDamage(r.damage.total)}
                className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono-cart uppercase tracking-wider bg-red-700/50 hover:bg-red-600 text-red-50"
                title="Apply this hit's damage to the selected target"
              >
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
      {totalDamage > 0 && (
        <div className="pt-1 border-t border-amber-500/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-cart text-stone-400">
              {totalHits} hit{totalHits === 1 ? "" : "s"} ·{" "}
              <span className="text-red-300 font-bold">{totalDamage}</span> total
              dmg
            </span>
          </div>
          {validTargets.length === 0 ? (
            <div className="text-[9px] text-stone-500 italic">
              No valid targets — add a combatant to apply damage.
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <select
                data-testid={`target-select-${combatantId}`}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="flex-1 h-7 bg-black/50 border border-white/10 rounded-md px-1.5 text-[10px] font-mono-cart text-stone-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="">Apply damage to…</option>
                {validTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.kind === "pc" ? "🧝 " : "👹 "}${t.name} — ${t.currentHp}/${t.maxHp}`}
                  </option>
                ))}
              </select>
              <button
                data-testid={`apply-total-${combatantId}`}
                onClick={() => applyDamage(totalDamage)}
                disabled={!targetId}
                className="px-2 h-7 rounded-md bg-red-600 hover:bg-red-500 text-stone-50 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                title="Subtract total damage from the selected target's HP"
              >
                Apply {totalDamage}
              </button>
            </div>
          )}
          {applied && (
            <div className="text-[10px] font-mono-cart text-emerald-300 text-center animate-pulse">
              ✓ Applied {applied.amount} damage to{" "}
              {allCombatants.find((c) => c.id === applied.targetId)?.name}
            </div>
          )}
          <button
            data-testid={`apply-on-map-${combatantId}`}
            onClick={() =>
              dispatch({
                type: "ARM_DAMAGE",
                amount: totalDamage,
                attackerId: combatantId,
                attackerName,
              })
            }
            className="w-full px-2 h-7 rounded-md bg-amber-700/40 hover:bg-amber-600 text-amber-50 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
            title="Then click the target token on the map to apply this damage"
          >
            <Crosshair className="w-3 h-3" /> Apply {totalDamage} to a token on the map
          </button>
          {state?.pendingDamage && (
            <div className="text-[10px] font-mono-cart text-amber-300 text-center animate-pulse flex items-center justify-center gap-2">
              Click a token on the map…
              <button
                data-testid={`cancel-apply-on-map-${combatantId}`}
                onClick={() => dispatch({ type: "DISARM_DAMAGE" })}
                className="underline hover:text-amber-100"
              >
                cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttackRow({ combatantId, attack, onRoll }) {
  const { dispatch } = useCombat();
  const upd = (patch) =>
    dispatch({ type: "UPDATE_ATTACK", combatantId, attackId: attack.id, patch });

  return (
    <div
      className="rounded-md bg-black/40 p-1.5 space-y-1"
      data-testid={`attack-row-${attack.id}`}
    >
      <div className="flex items-center gap-1">
        <Input
          data-testid={`attack-name-${attack.id}`}
          value={attack.name}
          onChange={(e) => upd({ name: e.target.value })}
          placeholder="Attack name"
          className="bg-transparent border-0 h-6 text-[11px] px-1 font-semibold flex-1 min-w-0 focus-visible:ring-0"
        />
        <button
          data-testid={`attack-roll-${attack.id}`}
          onClick={() => onRoll(attack)}
          className="px-2 h-6 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
          title="Roll attack"
        >
          <Swords className="w-3 h-3" /> Roll
        </button>
        <button
          onClick={() =>
            dispatch({ type: "REMOVE_ATTACK", combatantId, attackId: attack.id })
          }
          className="text-stone-500 hover:text-red-400 p-0.5"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1 text-[9px] font-mono-cart">
        <label className="flex flex-col gap-0.5">
          <span className="text-stone-500 uppercase">Bonus</span>
          <Input
            data-testid={`attack-bonus-${attack.id}`}
            type="number"
            value={attack.attackBonus}
            onChange={(e) =>
              upd({ attackBonus: parseInt(e.target.value, 10) || 0 })
            }
            className="bg-black/40 border-white/10 h-6 text-[10px] px-1 text-center"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-stone-500 uppercase">Dice</span>
          <Input
            data-testid={`attack-dice-${attack.id}`}
            value={attack.damageDice}
            onChange={(e) => upd({ damageDice: e.target.value })}
            placeholder="2d8"
            className="bg-black/40 border-white/10 h-6 text-[10px] px-1 text-center"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-stone-500 uppercase">Dmg+</span>
          <Input
            data-testid={`attack-dmg-mod-${attack.id}`}
            type="number"
            value={attack.damageModifier}
            onChange={(e) =>
              upd({ damageModifier: parseInt(e.target.value, 10) || 0 })
            }
            className="bg-black/40 border-white/10 h-6 text-[10px] px-1 text-center"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-stone-500 uppercase"># Atk</span>
          <Input
            data-testid={`attack-num-${attack.id}`}
            type="number"
            min="1"
            value={attack.numAttacks}
            onChange={(e) =>
              upd({
                numAttacks: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="bg-black/40 border-white/10 h-6 text-[10px] px-1 text-center"
          />
        </label>
      </div>
    </div>
  );
}
