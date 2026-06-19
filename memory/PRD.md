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

## Backlog
- P1: fal.ai or alternate AI upscaler when user is ready to pay or wants user-supplied keys
- P2: Mask-based inpainting (paint a precise mask then describe what fills it)
- P2: Pin selection / multi-select / cut-copy-paste shapes
- P2: Shared / read-only public campaign view for players
- P2: Real-time multi-user collaboration
