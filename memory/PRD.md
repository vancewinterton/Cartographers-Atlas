# Cartographer's Atlas — D&D Campaign Map Editor

## Original Problem Statement
Build a D&D campaign map editor inspired by mapgenie.io/skyrim that:
- Imports existing map images and lets the user annotate them on top
- Provides a full drawing toolkit (freehand brush + shapes: rect, circle, polygon, text labels, pins)
- Lets the user drag-select a region and ask an AI to redraw it ("draw a city here")
- Supports nested maps — click a pin (e.g. dungeon icon) to open a separate linked map
- Mini Google-Earth feel: pan/zoom across a giant world map with crisp quality

## User Choices (gathered in iteration 1)
- AI region redraw: **both** Gemini Nano Banana (image-based editing) and OpenAI GPT Image 1 (text-to-image)
- AI upscaling: skip for now (browser zoom only)
- Auth: none (single-user local tool)
- Storage: multiple campaigns + nested sub-maps via clickable pins

## Architecture
- **Backend**: FastAPI + MongoDB. Routes under `/api`. Models: `Campaign`, `MapDoc` (with `parent_map_id`, `parent_pin_id`), `Pin`. AI endpoint dispatches to `emergentintegrations` LlmChat (Gemini) or OpenAIImageGeneration (gpt-image-1) using `EMERGENT_LLM_KEY`.
- **Frontend**: React + React Router + Tailwind + shadcn UI. `react-zoom-pan-pinch` for pan/zoom. Drawings stored as JSON shapes in map image coordinates and rendered via SVG so they stay crisp at every zoom level. Layers, pins, autosave.

## Implemented (2026-02-19)
- Campaign dashboard with create/delete (auto-creates root World Map)
- Editor with floating top bar, tool dock (pan, brush, rect, circle, polygon, text, pin, AI redraw, erase), properties panel (color palette, brush size slider, layers add/visibility/lock/delete, tool help)
- Map canvas: zoom/pan, import image, draw all shape types, text labels, undo/redo (50-step history)
- Pins with bouncy animation; click pin → opens NestedMapSheet
- Nested sub-map flow: create linked sub-map from pin sheet → navigates to `/campaign/:id/map/:mapId`
- AI Redraw: drag region → dialog with crop preview, prompt input, model picker (Nano Banana inpaints from cropped region; GPT Image 1 generates from prompt)
- Autosave every 1.5s + manual save

## Tested
- Backend: 14/14 pytest tests pass — full CRUD + both AI models verified
- Frontend: end-to-end pin → nested map flow verified via Playwright

## Backlog (P1/P2)
- P1: Add AI upscaler (fal.ai integration) for boosting map resolution
- P1: Recursive cascade delete for nested sub-sub-maps
- P1: Per-pin custom icons (tavern, castle, dungeon, skull, etc.)
- P2: Multi-user / sharing
- P2: Export composed map as PNG (rasterize SVG + base image)
- P2: Image-mask inpainting (paint a mask, AI fills only that mask)
- P2: Drag-to-reposition existing pins
