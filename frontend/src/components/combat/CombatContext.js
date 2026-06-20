import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

/**
 * Combat domain model
 * ─────────────────────────────────────────────────────────────
 * Attack    { id, name, attackBonus, damageDice, damageModifier, numAttacks }
 * Combatant { id, kind:'pc'|'enemy', name, color, initiativeMod, initiativeRoll,
 *             maxHp, currentHp, ac, attacks[], conditions[], concentration }
 * LogEntry  { id, ts, type, text, meta? }
 * State     { combatants[], active, currentTurnIndex, round, log[], settings, savedEncounters[] }
 */

const PRESET_CONDITIONS = [
  "Poisoned",
  "Stunned",
  "Restrained",
  "Charmed",
  "Frightened",
  "Prone",
  "Blinded",
  "Paralyzed",
  "Unconscious",
];

const DEFAULT_SETTINGS = {
  autoRollInit: false,
  autoRemoveDead: false,
  allowOverheal: false,
  trackConcentration: true,
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const nowTs = () => Date.now();

// ───────── dice ─────────
export const rollDie = (sides) => 1 + Math.floor(Math.random() * sides);

export const rollDice = (n, sides) =>
  Array.from({ length: Math.max(0, n) }, () => rollDie(sides));

/** Parse "2d8", "1d20", "d6", "3d10" → {count, sides}.  Falls back to {0,0}. */
export const parseDice = (formula) => {
  const m = String(formula || "").trim().match(/^(\d*)d(\d+)$/i);
  if (!m) return { count: 0, sides: 0 };
  return { count: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10) };
};

const blankAttack = () => ({
  id: uid(),
  name: "Attack",
  attackBonus: 4,
  damageDice: "1d8",
  damageModifier: 2,
  numAttacks: 1,
});

export const makeCombatant = (kind, overrides = {}) => ({
  id: uid(),
  kind,
  name: kind === "pc" ? "New Hero" : "New Enemy",
  color: kind === "pc" ? "#3B82F6" : "#EF4444",
  initiativeMod: 0,
  initiativeRoll: null,
  maxHp: kind === "pc" ? 30 : 15,
  currentHp: kind === "pc" ? 30 : 15,
  ac: 13,
  attacks: kind === "enemy" ? [blankAttack()] : [],
  conditions: [],
  concentration: false,
  ...overrides,
});

// ───────── status helpers ─────────
export const statusOf = (c) => {
  if (c.currentHp <= 0) return "Dead";
  if (c.currentHp <= c.maxHp * 0.5) return "Bloodied";
  return "Alive";
};

// ───────── reducer ─────────
const initialState = {
  combatants: [],
  active: false,
  currentTurnIndex: 0,
  round: 0,
  log: [],
  settings: { ...DEFAULT_SETTINGS },
  savedEncounters: [],
};

const pushLog = (log, type, text, meta) =>
  [{ id: uid(), ts: nowTs(), type, text, meta }, ...log].slice(0, 300);

const sortByInit = (list) =>
  [...list].sort((a, b) => {
    const ar = a.initiativeRoll ?? -999;
    const br = b.initiativeRoll ?? -999;
    if (br !== ar) return br - ar;
    return (b.initiativeMod || 0) - (a.initiativeMod || 0);
  });

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload };

    case "ADD_COMBATANT": {
      const c = action.payload;
      let log = pushLog(state.log, "info", `${c.name} joined the encounter.`);
      let combatants = [...state.combatants, c];
      if (state.settings.autoRollInit) {
        const r = rollDie(20) + (c.initiativeMod || 0);
        combatants = combatants.map((x) =>
          x.id === c.id ? { ...x, initiativeRoll: r } : x
        );
        log = pushLog(log, "init", `${c.name} rolled initiative: ${r}`);
      }
      return { ...state, combatants, log };
    }

    case "REMOVE_COMBATANT": {
      const c = state.combatants.find((x) => x.id === action.id);
      if (!c) return state;
      const combatants = state.combatants.filter((x) => x.id !== action.id);
      let currentTurnIndex = state.currentTurnIndex;
      if (state.active) {
        const sorted = sortByInit(state.combatants);
        const removedIdx = sorted.findIndex((x) => x.id === action.id);
        if (removedIdx < currentTurnIndex) currentTurnIndex -= 1;
        if (currentTurnIndex >= combatants.length) currentTurnIndex = 0;
      }
      return {
        ...state,
        combatants,
        currentTurnIndex,
        log: pushLog(state.log, "info", `${c.name} was removed.`),
      };
    }

    case "DUPLICATE_COMBATANT": {
      const src = state.combatants.find((x) => x.id === action.id);
      if (!src) return state;
      const baseName = src.name.replace(/\s+\d+$/, "");
      const used = state.combatants
        .filter((c) => c.name === baseName || c.name.startsWith(`${baseName} `))
        .map((c) => {
          const m = c.name.match(/\s+(\d+)$/);
          return m ? parseInt(m[1], 10) : 1;
        });
      const next = (used.length ? Math.max(...used) : 1) + 1;
      const copy = {
        ...src,
        id: uid(),
        name: `${baseName} ${next}`,
        attacks: src.attacks.map((a) => ({ ...a, id: uid() })),
        conditions: [...src.conditions],
        initiativeRoll: null,
      };
      let combatants = [...state.combatants, copy];
      let log = pushLog(state.log, "info", `Duplicated → ${copy.name}.`);
      if (state.settings.autoRollInit) {
        const r = rollDie(20) + (copy.initiativeMod || 0);
        combatants = combatants.map((x) =>
          x.id === copy.id ? { ...x, initiativeRoll: r } : x
        );
        log = pushLog(log, "init", `${copy.name} rolled initiative: ${r}`);
      }
      return { ...state, combatants, log };
    }

    case "UPDATE_COMBATANT": {
      const combatants = state.combatants.map((c) =>
        c.id === action.id ? { ...c, ...action.patch } : c
      );
      return { ...state, combatants };
    }

    case "MODIFY_HP": {
      const { id, delta, overrideMax } = action;
      const c = state.combatants.find((x) => x.id === id);
      if (!c) return state;
      const prevHp = c.currentHp;
      const allowOver = state.settings.allowOverheal || overrideMax;
      let newHp = prevHp + delta;
      if (newHp < 0) newHp = 0;
      if (!allowOver && newHp > c.maxHp) newHp = c.maxHp;
      const verb = delta < 0 ? "took" : "healed";
      let log = pushLog(
        state.log,
        "hp",
        `${c.name} ${verb} ${Math.abs(delta)} HP → ${newHp}/${c.maxHp}`
      );
      const wasAlive = prevHp > 0;
      const isDead = newHp <= 0;
      if (wasAlive && isDead) {
        log = pushLog(log, "death", `💀 ${c.name} dropped to 0 HP.`);
      }
      let combatants = state.combatants.map((x) =>
        x.id === id ? { ...x, currentHp: newHp } : x
      );
      if (state.settings.autoRemoveDead && isDead) {
        combatants = combatants.filter((x) => x.id !== id);
        log = pushLog(log, "info", `${c.name} was auto-removed (dead).`);
      }
      return { ...state, combatants, log };
    }

    case "SET_HP": {
      const { id, value } = action;
      const c = state.combatants.find((x) => x.id === id);
      if (!c) return state;
      const allowOver = state.settings.allowOverheal;
      let v = Math.max(0, Number(value) || 0);
      if (!allowOver && v > c.maxHp) v = c.maxHp;
      const log = pushLog(
        state.log,
        "hp",
        `${c.name} HP set → ${v}/${c.maxHp}`
      );
      return {
        ...state,
        combatants: state.combatants.map((x) =>
          x.id === id ? { ...x, currentHp: v } : x
        ),
        log,
      };
    }

    case "ROLL_ALL_INIT": {
      let log = state.log;
      const combatants = state.combatants.map((c) => {
        const r = rollDie(20) + (c.initiativeMod || 0);
        log = pushLog(log, "init", `${c.name} rolled initiative: ${r}`);
        return { ...c, initiativeRoll: r };
      });
      return { ...state, combatants, log };
    }

    case "ROLL_ONE_INIT": {
      const c = state.combatants.find((x) => x.id === action.id);
      if (!c) return state;
      const r = rollDie(20) + (c.initiativeMod || 0);
      return {
        ...state,
        combatants: state.combatants.map((x) =>
          x.id === action.id ? { ...x, initiativeRoll: r } : x
        ),
        log: pushLog(state.log, "init", `${c.name} rolled initiative: ${r}`),
      };
    }

    case "START_COMBAT": {
      if (!state.combatants.length) return state;
      let log = pushLog(state.log, "info", `⚔ Combat started.`);
      log = pushLog(log, "round", `— Round 1 —`);
      return { ...state, active: true, round: 1, currentTurnIndex: 0, log };
    }

    case "END_COMBAT": {
      const log = pushLog(state.log, "info", `🏳 Combat ended.`);
      return { ...state, active: false, round: 0, currentTurnIndex: 0, log };
    }

    case "NEXT_TURN": {
      if (!state.active || !state.combatants.length) return state;
      const sorted = sortByInit(state.combatants);
      const nextIdx = (state.currentTurnIndex + 1) % sorted.length;
      const newRound = nextIdx === 0 ? state.round + 1 : state.round;
      let log = state.log;
      if (sorted[nextIdx]) {
        log = pushLog(log, "turn", `▶ ${sorted[nextIdx].name}'s turn.`);
      }
      if (nextIdx === 0) {
        log = pushLog(log, "round", `— Round ${newRound} —`);
      }
      return { ...state, currentTurnIndex: nextIdx, round: newRound, log };
    }

    case "PREV_TURN": {
      if (!state.active || !state.combatants.length) return state;
      const sorted = sortByInit(state.combatants);
      let nextIdx = state.currentTurnIndex - 1;
      let newRound = state.round;
      if (nextIdx < 0) {
        nextIdx = sorted.length - 1;
        newRound = Math.max(1, state.round - 1);
      }
      const log = sorted[nextIdx]
        ? pushLog(state.log, "turn", `◀ Back to ${sorted[nextIdx].name}'s turn.`)
        : state.log;
      return { ...state, currentTurnIndex: nextIdx, round: newRound, log };
    }

    case "ADD_ATTACK": {
      return {
        ...state,
        combatants: state.combatants.map((c) =>
          c.id === action.id
            ? { ...c, attacks: [...c.attacks, blankAttack()] }
            : c
        ),
      };
    }

    case "UPDATE_ATTACK": {
      return {
        ...state,
        combatants: state.combatants.map((c) =>
          c.id === action.combatantId
            ? {
                ...c,
                attacks: c.attacks.map((a) =>
                  a.id === action.attackId ? { ...a, ...action.patch } : a
                ),
              }
            : c
        ),
      };
    }

    case "REMOVE_ATTACK": {
      return {
        ...state,
        combatants: state.combatants.map((c) =>
          c.id === action.combatantId
            ? { ...c, attacks: c.attacks.filter((a) => a.id !== action.attackId) }
            : c
        ),
      };
    }

    case "LOG_ATTACK": {
      const { text, entryType = "attack" } = action;
      return { ...state, log: pushLog(state.log, entryType, text) };
    }

    case "TOGGLE_CONDITION": {
      const { id, condition } = action;
      const c = state.combatants.find((x) => x.id === id);
      if (!c) return state;
      const has = c.conditions.includes(condition);
      const conditions = has
        ? c.conditions.filter((x) => x !== condition)
        : [...c.conditions, condition];
      const log = pushLog(
        state.log,
        "info",
        `${c.name} ${has ? "lost" : "gained"} condition: ${condition}.`
      );
      return {
        ...state,
        combatants: state.combatants.map((x) =>
          x.id === id ? { ...x, conditions } : x
        ),
        log,
      };
    }

    case "TOGGLE_CONCENTRATION": {
      const c = state.combatants.find((x) => x.id === action.id);
      if (!c) return state;
      const next = !c.concentration;
      return {
        ...state,
        combatants: state.combatants.map((x) =>
          x.id === action.id ? { ...x, concentration: next } : x
        ),
        log: pushLog(
          state.log,
          "info",
          `${c.name} ${next ? "started" : "broke"} concentration.`
        ),
      };
    }

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "CLEAR_LOG":
      return { ...state, log: [] };

    case "RESET":
      return { ...initialState, savedEncounters: state.savedEncounters };

    case "SAVE_ENCOUNTER": {
      const snap = {
        id: uid(),
        name: action.name || `Encounter ${state.savedEncounters.length + 1}`,
        ts: nowTs(),
        combatants: state.combatants,
        log: state.log,
      };
      return {
        ...state,
        savedEncounters: [snap, ...state.savedEncounters].slice(0, 25),
      };
    }

    case "LOAD_ENCOUNTER": {
      const snap = state.savedEncounters.find((e) => e.id === action.id);
      if (!snap) return state;
      return {
        ...state,
        combatants: snap.combatants.map((c) => ({
          ...c,
          attacks: c.attacks?.map((a) => ({ ...a })) || [],
          conditions: [...(c.conditions || [])],
        })),
        active: false,
        round: 0,
        currentTurnIndex: 0,
        log: pushLog(state.log, "info", `📂 Loaded encounter "${snap.name}".`),
      };
    }

    case "DELETE_ENCOUNTER":
      return {
        ...state,
        savedEncounters: state.savedEncounters.filter((e) => e.id !== action.id),
      };

    default:
      return state;
  }
}

// ───────── context ─────────
const CombatContext = createContext(null);

function lazyInit(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...initialState,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    }
  } catch {
    /* invalid stored JSON */
  }
  return initialState;
}

export function CombatProvider({ children, storageKey = "combat_state_default" }) {
  const [state, dispatch] = useReducer(reducer, storageKey, lazyInit);

  // persist every state change — no race because state was seeded from storage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* quota exceeded */
    }
  }, [state, storageKey]);

  const value = useMemo(
    () => ({ state, dispatch, presetConditions: PRESET_CONDITIONS }),
    [state]
  );
  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>;
}

export function useCombat() {
  const ctx = useContext(CombatContext);
  if (!ctx) throw new Error("useCombat must be used within CombatProvider");
  return ctx;
}

// ───────── attack rolling (pure) ─────────
/**
 * Execute one full attack (possibly multiattack). Returns { results, summary }
 *   results: [{ idx, hitRoll, hitTotal, isCrit, isFumble, damage:{rolls,total,critRolls?} }]
 */
export function executeAttack(attack) {
  const num = Math.max(1, Math.min(20, parseInt(attack.numAttacks, 10) || 1));
  const { count, sides } = parseDice(attack.damageDice);
  const dmgMod = parseInt(attack.damageModifier, 10) || 0;
  const hitBonus = parseInt(attack.attackBonus, 10) || 0;
  const results = [];
  for (let i = 0; i < num; i++) {
    const hitRoll = rollDie(20);
    const hitTotal = hitRoll + hitBonus;
    const isCrit = hitRoll === 20;
    const isFumble = hitRoll === 1;
    let damage = null;
    if (sides > 0 && !isFumble) {
      const baseRolls = rollDice(count, sides);
      let critRolls = null;
      let diceTotal = baseRolls.reduce((a, b) => a + b, 0);
      if (isCrit) {
        critRolls = rollDice(count, sides);
        diceTotal += critRolls.reduce((a, b) => a + b, 0);
      }
      damage = {
        rolls: baseRolls,
        critRolls,
        modifier: dmgMod,
        total: diceTotal + dmgMod,
      };
    }
    results.push({ idx: i, hitRoll, hitBonus, hitTotal, isCrit, isFumble, damage });
  }
  return results;
}

export { PRESET_CONDITIONS };
