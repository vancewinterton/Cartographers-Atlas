// Personal token library, stored per-browser in localStorage. Each user (DM or a
// share-link viewer) keeps their own saved tokens so they can drop a hero/enemy
// onto any map at any time, across campaigns and sessions.

const KEY = "cartographer_token_library_v1";

const rid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export function getLibrary() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToken(tpl) {
  const lib = getLibrary();
  const id = tpl.id || rid();
  const entry = {
    id,
    label: tpl.label || "Token",
    description: tpl.description || "",
    color: tpl.color || "#3B82F6",
    size: tpl.size || 40,
    hp: tpl.hp ?? null,
    hpMax: tpl.hpMax ?? null,
    ac: tpl.ac ?? null,
    initBonus: tpl.initBonus ?? 0,
    attacks: Array.isArray(tpl.attacks) ? tpl.attacks : [],
  };
  const next = [entry, ...lib.filter((t) => t.id !== id)].slice(0, 100);
  localStorage.setItem(KEY, JSON.stringify(next));
  return entry;
}

export function removeToken(id) {
  const next = getLibrary().filter((t) => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
