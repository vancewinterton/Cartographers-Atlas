import { useEffect, useMemo, useState } from "react";
import { useCombat, makeCombatant } from "./CombatContext";
import CombatantCard from "./CombatantCard";
import CombatLog from "./CombatLog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Swords,
  X,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Plus,
  Shuffle,
  Save,
  FolderOpen,
  Settings,
  UserPlus,
  Skull,
} from "lucide-react";

const sortByInit = (list) =>
  [...list].sort((a, b) => {
    const ar = a.initiativeRoll ?? -999;
    const br = b.initiativeRoll ?? -999;
    if (br !== ar) return br - ar;
    return (b.initiativeMod || 0) - (a.initiativeMod || 0);
  });

export default function CombatTrackerPanel({ onClose }) {
  const { state, dispatch } = useCombat();
  const sorted = useMemo(() => sortByInit(state.combatants), [state.combatants]);
  const activeId = state.active ? sorted[state.currentTurnIndex]?.id : null;

  const [tab, setTab] = useState("initiative"); // 'initiative' | 'log' | 'encounters'
  const [showSettings, setShowSettings] = useState(false);
  const [encounterName, setEncounterName] = useState("");

  // Reset to round 1 if combat ends
  useEffect(() => {
    if (!state.active && state.round !== 0) {
      // already handled by END_COMBAT
    }
  }, [state.active, state.round]);

  const canStart = state.combatants.length > 0;

  return (
    <div
      data-testid="combat-tracker-panel"
      className="absolute left-20 top-20 z-30 glass rounded-2xl flex flex-col w-[380px] max-h-[85vh] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-500" />
          <h2 className="font-display text-xl">Combat Tracker</h2>
          {state.active && (
            <span
              data-testid="round-indicator"
              className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 text-[10px] font-mono-cart uppercase tracking-widest border border-amber-500/30"
            >
              Round {state.round}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="settings-toggle"
            onClick={() => setShowSettings((v) => !v)}
            className={`p-1.5 rounded transition ${
              showSettings
                ? "bg-amber-500/20 text-amber-400"
                : "text-stone-400 hover:text-amber-400 hover:bg-white/5"
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            data-testid="combat-close"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-1.5 rounded hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <SettingsDrawer />
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {[
          { id: "initiative", label: "Initiative", icon: Swords },
          { id: "log", label: "Log", icon: null },
          { id: "encounters", label: "Encounters", icon: null },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 text-[11px] font-mono-cart uppercase tracking-widest transition ${
              tab === t.id
                ? "text-amber-400 border-b-2 border-amber-500 bg-amber-500/5"
                : "text-stone-500 hover:text-stone-200"
            }`}
          >
            {t.label}
            {t.id === "initiative" && state.combatants.length > 0 && (
              <span className="ml-1.5 text-[9px] opacity-70">
                ({state.combatants.length})
              </span>
            )}
            {t.id === "log" && state.log.length > 0 && (
              <span className="ml-1.5 text-[9px] opacity-70">({state.log.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Turn controls (only on initiative tab) */}
      {tab === "initiative" && (
        <div className="flex items-center gap-1.5 p-3 border-b border-white/5 flex-wrap">
          {!state.active ? (
            <Button
              data-testid="start-combat"
              size="sm"
              onClick={() => dispatch({ type: "START_COMBAT" })}
              disabled={!canStart}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950 h-8 font-bold flex-1"
            >
              <Play className="w-3.5 h-3.5 mr-1" /> Start Combat
            </Button>
          ) : (
            <>
              <Button
                data-testid="prev-turn"
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: "PREV_TURN" })}
                className="text-stone-200 hover:bg-white/5 h-8 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                data-testid="next-turn"
                size="sm"
                onClick={() => dispatch({ type: "NEXT_TURN" })}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950 h-8 flex-1 font-bold"
              >
                Next Turn <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button
                data-testid="end-combat"
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: "END_COMBAT" })}
                className="text-red-300 hover:bg-red-500/10 hover:text-red-200 h-8 px-2"
                title="End combat"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <Button
            data-testid="roll-all-init"
            size="sm"
            variant="ghost"
            onClick={() => dispatch({ type: "ROLL_ALL_INIT" })}
            disabled={!state.combatants.length}
            className="text-stone-200 hover:bg-white/5 h-8 px-2"
            title="Roll initiative for all"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "initiative" && (
          <InitiativeTab sorted={sorted} activeId={activeId} />
        )}
        {tab === "log" && <CombatLog />}
        {tab === "encounters" && (
          <EncountersTab
            encounterName={encounterName}
            setEncounterName={setEncounterName}
          />
        )}
      </div>

      {/* Footer: add combatants */}
      {tab === "initiative" && (
        <div className="p-3 border-t border-white/5 flex items-center gap-1.5">
          <Button
            data-testid="add-pc"
            size="sm"
            variant="ghost"
            onClick={() =>
              dispatch({ type: "ADD_COMBATANT", payload: makeCombatant("pc") })
            }
            className="flex-1 h-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 border border-blue-500/20"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Add PC
          </Button>
          <Button
            data-testid="add-enemy"
            size="sm"
            variant="ghost"
            onClick={() =>
              dispatch({ type: "ADD_COMBATANT", payload: makeCombatant("enemy") })
            }
            className="flex-1 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20"
          >
            <Skull className="w-3.5 h-3.5 mr-1" /> Add Enemy
          </Button>
        </div>
      )}
    </div>
  );
}

function InitiativeTab({ sorted, activeId }) {
  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-stone-500 text-sm">
        <Swords className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <div>No combatants yet.</div>
        <div className="text-[11px] mt-1 text-stone-600">
          Add a PC or Enemy below to begin.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {sorted.map((c, idx) => (
        <CombatantCard
          key={c.id}
          combatant={c}
          isCurrent={c.id === activeId}
          position={idx}
        />
      ))}
    </div>
  );
}

function SettingsDrawer() {
  const { state, dispatch } = useCombat();
  const s = state.settings;
  const item = (key, label, hint) => (
    <label
      className="flex items-start gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 rounded"
      data-testid={`setting-${key}`}
    >
      <input
        type="checkbox"
        checked={!!s[key]}
        onChange={(e) =>
          dispatch({ type: "UPDATE_SETTINGS", patch: { [key]: e.target.checked } })
        }
        className="mt-0.5 accent-amber-500"
      />
      <div className="flex-1">
        <div className="text-xs text-stone-200">{label}</div>
        {hint && <div className="text-[10px] text-stone-500">{hint}</div>}
      </div>
    </label>
  );
  return (
    <div
      className="bg-black/40 border-b border-amber-700/20 py-2"
      data-testid="settings-drawer"
    >
      {item("autoRollInit", "Auto-roll initiative", "When a combatant is added")}
      {item("autoRemoveDead", "Auto-remove dead combatants", "Remove on 0 HP")}
      {item("allowOverheal", "Allow overheal", "HP can exceed Max")}
      {item("trackConcentration", "Track concentration", "Show concentration button")}
    </div>
  );
}

function EncountersTab({ encounterName, setEncounterName }) {
  const { state, dispatch } = useCombat();
  return (
    <div className="space-y-3" data-testid="encounters-tab">
      <div className="rounded-lg bg-black/30 border border-amber-700/20 p-2.5 space-y-2">
        <div className="text-[10px] font-mono-cart uppercase tracking-widest text-amber-400">
          Save Current Encounter
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            data-testid="encounter-name"
            value={encounterName}
            onChange={(e) => setEncounterName(e.target.value)}
            placeholder="Encounter name…"
            className="bg-black/40 border-white/10 h-7 text-xs"
          />
          <Button
            data-testid="save-encounter"
            size="sm"
            onClick={() => {
              if (!state.combatants.length) return;
              dispatch({
                type: "SAVE_ENCOUNTER",
                name: encounterName.trim() || undefined,
              });
              setEncounterName("");
            }}
            disabled={!state.combatants.length}
            className="bg-amber-600 hover:bg-amber-500 text-stone-950 h-7 px-3 text-xs font-bold"
          >
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
        <div className="text-[10px] text-stone-500">
          Saves {state.combatants.length} combatant
          {state.combatants.length === 1 ? "" : "s"} + combat log.
        </div>
      </div>

      <div>
        <div className="text-[10px] font-mono-cart uppercase tracking-widest text-stone-400 mb-1.5 px-1">
          Saved Encounters ({state.savedEncounters.length})
        </div>
        {state.savedEncounters.length === 0 ? (
          <div className="text-center py-4 text-stone-600 text-[11px]">
            No saved encounters yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {state.savedEncounters.map((enc) => (
              <div
                key={enc.id}
                data-testid={`saved-encounter-${enc.id}`}
                className="rounded-lg bg-black/30 border border-white/5 p-2 flex items-center gap-2"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-stone-200 truncate">{enc.name}</div>
                  <div className="text-[9px] text-stone-500 font-mono-cart">
                    {enc.combatants.length} combatant
                    {enc.combatants.length === 1 ? "" : "s"} ·{" "}
                    {new Date(enc.ts).toLocaleString()}
                  </div>
                </div>
                <button
                  data-testid={`load-${enc.id}`}
                  onClick={() => dispatch({ type: "LOAD_ENCOUNTER", id: enc.id })}
                  className="px-2 h-6 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 text-[10px] font-mono-cart uppercase tracking-wider"
                >
                  Load
                </button>
                <button
                  data-testid={`delete-encounter-${enc.id}`}
                  onClick={() => dispatch({ type: "DELETE_ENCOUNTER", id: enc.id })}
                  className="text-stone-500 hover:text-red-400 p-1"
                  title="Delete"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-white/5">
        <button
          data-testid="reset-combat"
          onClick={() => {
            if (window.confirm("Clear all combatants and log? (saved encounters kept)")) {
              dispatch({ type: "RESET" });
            }
          }}
          className="w-full text-[10px] font-mono-cart uppercase tracking-wider text-red-400/70 hover:text-red-300 py-1.5 rounded border border-dashed border-red-700/20 hover:border-red-500/40 transition"
        >
          Clear Combatants
        </button>
      </div>
    </div>
  );
}
