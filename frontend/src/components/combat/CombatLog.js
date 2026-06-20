import { useCombat } from "./CombatContext";
import { Trash2 } from "lucide-react";

const TYPE_STYLES = {
  init: "text-blue-300",
  turn: "text-amber-300",
  attack: "text-orange-300",
  damage: "text-red-300",
  hp: "text-emerald-300",
  death: "text-red-400 font-semibold",
  round: "text-amber-500 font-mono-cart uppercase tracking-widest text-center",
  info: "text-stone-400",
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function CombatLog() {
  const { state, dispatch } = useCombat();
  const { log } = state;

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="combat-log">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Combat Log
        </span>
        {log.length > 0 && (
          <button
            data-testid="combat-log-clear"
            onClick={() => dispatch({ type: "CLEAR_LOG" })}
            className="text-stone-500 hover:text-red-400 p-1 rounded"
            title="Clear log"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto rounded-lg bg-black/30 border border-white/5 p-2 space-y-0.5 font-mono-cart text-[11px]">
        {log.length === 0 ? (
          <div className="text-stone-600 text-center py-3 text-[10px]">
            No combat events yet.
          </div>
        ) : (
          log.map((entry) => (
            <div
              key={entry.id}
              data-testid={`log-entry-${entry.type}`}
              className={`flex items-baseline gap-2 leading-tight ${
                entry.type === "round" ? "justify-center my-1" : ""
              }`}
            >
              {entry.type !== "round" && (
                <span className="text-stone-600 text-[9px] shrink-0 w-14">
                  {formatTime(entry.ts)}
                </span>
              )}
              <span className={`${TYPE_STYLES[entry.type] || "text-stone-300"} flex-1`}>
                {entry.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
