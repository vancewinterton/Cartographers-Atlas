# Cartographer's Atlas — D&D Campaign Map Editor

## Original Problem Statement
Build a D&D campaign map editor inspired by mapgenie.io/skyrim that:
- Imports existing map images and lets the user annotate them on top
- Provides a full drawing toolkit (freehand brush + shapes: rect, circle, polygon, text labels, pins)
- Lets the user drag-select a region and ask an AI to redraw it ("draw a city here")
- Supports nested maps — click a pin (e.g. dungeon icon) to open a separate linked map
- Mini Google-Earth feel: pan/zoom across a giant world map with crisp quality

## User Choices
- AI region redraw: both Gemini Nano Banana + OpenAI gpt-image-1
- Auth: none
- Storage: multiple campaigns + nested sub-maps via clickable pins
- fal.ai upscaler: SKIPPED (user opted out due to per-call costs)

## Architecture
- Backend: FastAPI + MongoDB. Routes under `/api`. Models: Campaign, MapDoc (parent_map_id, parent_pin_id for nesting). AI endpoint uses emergentintegrations (Gemini Nano Banana / OpenAI gpt-image-1) with EMERGENT_LLM_KEY. Recursive cascade delete for nested children.
- Frontend: React + react-zoom-pan-pinch + Tailwind + shadcn. Drawings stored as JSON shapes in map coordinates and rendered as SVG so they stay sharp at every zoom.

## Implemented (2026-02-19)
- Campaign dashboard (create / delete, auto-creates root World Map)
- Editor: pan/zoom canvas + tool dock + layers + autosave + manual save
- Drawing toolkit: brush, rect, circle, polygon, text, pins, erase, undo/redo (50-step)
- AI Region Redraw with Nano Banana (edits cropped region) or GPT Image 1 (text-to-image)
- Pin → NestedMapSheet → create / open linked sub-map (`/campaign/:id/map/:mapId`)

## Implemented (2026-02-20 — iteration 2)
- Finer wheel zoom (0.06 step + smoothStep 0.005) so it doesn't jump
- Zoom +/- buttons + click-to-reset percentage badge
- **17 pin icon types** (pin, tavern, castle, town, dungeon, tomb, skull, forest, mountain, magic, treasure, camp, port, battle, ruins, lair, watch) + 6 color choices per pin
- **Draggable pins** — click to open sheet, drag to reposition (4px threshold)
- **AI "Blend edges" toggle** — feathered radial alpha mask so generated regions fade into surroundings instead of harsh rectangles
- **Recursive cascade delete** for nested sub-sub-maps (any depth)
- **Export PNG** — composes base image + shapes + pins onto a canvas and downloads

## Implemented (2026-02-20 — Combat Tracker rebuild)
- **Brand-new Combat Tracker** replacing old CombatPanel.js (deleted)
- Architecture: React Context + useReducer (`/app/frontend/src/components/combat/`)
  - `CombatContext.js` — provider, reducer, dice utilities, executeAttack (pure)
  - `CombatTrackerPanel.js` — main UI with Initiative/Log/Encounters tabs + settings drawer
  - `CombatantCard.js` — per-combatant HP bar, AC, init, HP controls, conditions, attacks
  - `CombatLog.js` — timestamped, color-coded combat log
- Features: Start/End Combat, Round counter (auto-increments), Next/Prev Turn, current-turn highlight
- Combatants: PC vs Enemy distinction, name, color, AC, initiative modifier + roll, HP/maxHP
- Status: Alive (>50%) / Bloodied (≤50%) / Dead (=0) with badge + colored HP bar
- HP controls: −5 / −1 / +1 / +5 / Heal Full / Set HP via input + Enter
- Attack rolling: per-attack panel with name/bonus/dice/dmg-mod/numAttacks
  - Rolls 1d20+bonus; detects Nat20 CRIT (doubles dice only, not modifier) + Nat1 FUMBLE
  - Multi-attack: separate rolls per attack tagged [n/total]
- Conditions: 9 presets (Poisoned, Stunned, Restrained, Charmed, Frightened, Prone, Blinded, Paralyzed, Unconscious) + custom condition input
- Concentration toggle per combatant
- Duplicate combatant with auto-incrementing name ("Goblin" → "Goblin 2" → "Goblin 3")
- Save/Load encounters (up to 25 snapshots in localStorage)
- Settings: Auto-roll Init on add, Auto-remove Dead, Allow Overheal, Track Concentration
- Persistence: per-campaign localStorage key `combat_state_<campaignId>` via lazy `useReducer` initializer (survives page reload)
- Combat log captures: initiative, turns, rounds, attacks, damage, HP changes, deaths
- Tested: 22/22 scenarios pass (testing_agent_v3 iteration_2 + persistence retest)

## Implemented (2026-02-20 — Map↔Tracker bridge + Campaign Save/Share)
- **Map enemies → Combat Tracker auto-import**: new `IMPORT_FROM_MAP` reducer action + "Import N tokens from map" button in tracker. Reads token color/label/hp/ac/initBonus/attacks. Idempotent via `sourceTokenId` (re-clicking is a no-op).
- **Color-based PC vs enemy classification**: blue-ish tokens → PC, anything else → enemy.
- **Inline attack result block** on each combatant card: shows d20 hit roll, bonus, total, CRIT/FUMBLE, damage dice rolls, modifier, total damage, and a "N hits · M dmg" summary. Multi-attack shows separate `1/3 · 2/3 · 3/3` lines.
- **Campaign Save / Share** (export + import):
  - Backend: `GET /api/campaigns/{id}/export` bundles campaign + all maps (with images, pins, shapes, sub-maps) into JSON. `POST /api/campaigns/import` accepts the JSON, generates fresh UUIDs, remaps `parent_map_id` and pin `linked_map_id` so nested structure stays intact, strips share token.
  - Topbar "Export Campaign" button downloads `<campaign>.cartographer.json`. Dashboard "Import" button (file picker) creates a new campaign and navigates to it.
- Tested: backend 6/6 pytest pass (export/import round-trip + edge cases). Frontend 11/11 scenarios pass.




## Implemented (2026-02-20 — Paint Panel + Hero spawn + damage targeting + HP public)
- **Paint Panel** (replaces single Brush button + standalone Erasers):
  - 8 paint variants: Brush, Marker, Highlighter, Pencil, Spray, Ink Pen, Soft Eraser, Hard Eraser
  - Each variant atomically sets {tool, brushVariant, brushOpacity, brushSize} via applyVariant()
  - 11 color swatches + HTML color picker + size slider (1–60) + opacity slider (10–100%)
  - Live SVG stroke preview at bottom of panel
  - MapCanvas renders brush strokes with variant-specific strokeOpacity/linecap/dasharray
- **Combat Tracker enhancements**:
  - 'Add PC' renamed to 'Add Hero' (testid kept as `add-pc` for compatibility)
  - Add Hero / Add Enemy now also spawn a matching colored token on the map (center) and link via `sourceTokenId`
  - Colored dot on each combatant card is now a `focus-token-<id>` button → opens ShapeEditPopover for the linked map token
  - AttackResultBlock has real target picker: dropdown of all OTHER alive combatants, "Apply N" button subtracts total damage, per-line "Apply" subtracts that hit only; combat log records "💥 attacker hits target for X damage"
- **Campaign-level HP bar visibility**:
  - New field `Campaign.hp_bars_public:bool` (default True)
  - PropertiesPanel toggle "Show HP to players" — patches backend via PATCH /api/campaigns/{id}
  - Share.js respects flag; when off, HP bars hidden on tokens in the public /share view (DM still sees them in editor)
  - Backend: 5 new pytest cases (test_hp_bars_public.py) — 25/25 backend tests pass
- Frontend testing 100% on critical paths.

## Implemented (2026-06-20 — iteration 5)
- **Add to Combat Tracker from the map**:
  - Single token: ShapeEditPopover now has `shape-add-combat-btn` (only for tokens) → imports that token into the tracker and opens it.
  - Multi-select: selection-actionbar shows `bulk-add-combat` when any selected shape is a token.
  - Both routes share `addTokensToCombat()` in Editor.js which dispatches `IMPORT_FROM_MAP` via `combatDispatchRef` (captured by `CombatDispatchBridge` inside CombatProvider).
- **Bidirectional real-time sync (DM ↔ viewers)**:
  - Editor now polls (`useMapPolling`, 2.5s) and applies remote changes via `applyRemoteMap`, guarded by `lastSavedTsRef`/`lastLocalEditRef`/`skipNextAutosaveRef` watermarks to prevent echo loops (3s local-edit grace window).
  - Viewers on the share link get paint tools: `viewer-tool-dock` (pan/paint) + reused PaintPanel; `persistShapes` made robust to empty layers. Verified both directions end-to-end (token drag + token placement + brush strokes propagate).
- **Spray paint** now renders a peppered scatter of dots (`sprayDots()` deterministic via `pseudoRand`) instead of a dashed highlighter line.
- **Soft Eraser** now erases continuously along a click-drag (onPointerMove calls `applySoftErase` while dragging), ending on release. Hard eraser also drag-deletes shapes under the cursor.
- **Hero Token tool** added to ToolDock (`tool-hero-token`, next to Enemy Token `tool-token`): places blue (#3B82F6) hero tokens hp 30/30; enemy token tool places red (#EF4444) hp 15/15. Blue tokens classify as Hero/pc on combat import.

## Backlog
- P1: fal.ai or alternate AI upscaler when user is ready to pay or wants user-supplied keys
- P2: Mask-based inpainting (paint a precise mask then describe what fills it)
- P2: Upgrade polling sync to WebSocket/SSE for snappier (<1s) real-time collaboration
- P2: Fix carry-over React hydration warning ('<option> cannot be a child of <span>') in CombatantCard target-select
