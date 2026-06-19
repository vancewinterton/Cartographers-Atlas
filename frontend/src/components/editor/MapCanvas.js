import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { getPinIcon } from "./pinIcons";

const HTML_SHAPE_TYPES = new Set(["asset", "token", "grid"]);

export default function MapCanvas({
  mapDoc,
  tool,
  color,
  brushSize,
  shapes,
  setShapes,
  pins,
  setPins,
  layers,
  activeLayerId,
  onPushHistory,
  onPinClick,
  onAIRegionSelected,
  pinColorFilter,
  onShapeClick,
  readOnly,
}) {
  const W = mapDoc.image_width || 1600;
  const H = mapDoc.image_height || 1000;

  const overlayRef = useRef(null);
  const [drawing, setDrawing] = useState(null); // {type, ...}
  const [polygonPts, setPolygonPts] = useState(null); // active polygon being drawn
  const [textInput, setTextInput] = useState(null); // {x,y}
  const transformRef = useRef(null);
  const [scale, setScale] = useState(1);
  const assetFileInputRef = useRef(null);
  const pendingAssetPosRef = useRef(null);
  const softErasePushedRef = useRef(false);

  // ---------- Helpers ----------
  const getMapCoords = (e) => {
    if (!overlayRef.current) return null;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { x, y };
  };

  const isPanTool = tool === "pan";
  const interactionEnabled = !isPanTool;

  // ---------- Drawing handlers ----------
  const onPointerDown = (e) => {
    // Middle-mouse pan: always allowed regardless of current tool
    if (e.button === 1) {
      e.preventDefault();
      const wrapEl = e.currentTarget.closest(".react-transform-wrapper");
      const startX = e.clientX;
      const startY = e.clientY;
      // Snapshot current transform from the live DOM matrix to avoid library internal APIs
      const contentEl = wrapEl?.querySelector(".react-transform-component");
      const startMatrix = contentEl ? new DOMMatrix(getComputedStyle(contentEl).transform) : null;
      const startTX = startMatrix?.e || 0;
      const startTY = startMatrix?.f || 0;
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (contentEl) {
          contentEl.style.transform = `matrix(${startMatrix.a}, 0, 0, ${startMatrix.d}, ${startTX + dx}, ${startTY + dy})`;
        }
      };
      const onUp = (ev) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        // Sync the library's internal position to the new translation we set manually
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (transformRef.current && (dx || dy)) {
          const s = scale;
          // Use library's setTransform to commit position so it remembers
          // transformRef.current.state may not be available — best-effort
          const curScale = transformRef.current?.state?.scale ?? s;
          const curX = (transformRef.current?.state?.positionX ?? startTX) + dx;
          const curY = (transformRef.current?.state?.positionY ?? startTY) + dy;
          transformRef.current.setTransform(curX, curY, curScale, 0);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }
    if (isPanTool) return;
    if (e.button !== 0) return;
    e.target.setPointerCapture?.(e.pointerId);
    const p = getMapCoords(e);
    if (!p) return;

    if (tool === "pin") {
      onPushHistory();
      setPins([
        ...pins,
        {
          id: rid(),
          x: p.x,
          y: p.y,
          label: "New Pin",
          description: "",
          color,
          icon: "pin",
          linked_map_id: null,
        },
      ]);
      return;
    }

    if (tool === "token") {
      onPushHistory();
      const sz = Math.max(4, brushSize * 4);
      setShapes([
        ...shapes,
        {
          id: rid(),
          type: "token",
          layerId: activeLayerId,
          color,
          size: sz,
          x: p.x,
          y: p.y,
          label: "",
          hp: null,
          hpMax: null,
          ac: null,
        },
      ]);
      return;
    }

    if (tool === "asset") {
      pendingAssetPosRef.current = p;
      assetFileInputRef.current?.click();
      return;
    }

    if (tool === "soft-erase") {
      onPushHistory();
      softErasePushedRef.current = true;
      applySoftErase(p);
      // begin a drawing pseudo-state so onPointerMove keeps erasing
      setDrawing({ type: "soft-erase", x: p.x, y: p.y });
      return;
    }

    if (tool === "text") {
      setTextInput({ x: p.x, y: p.y });
      return;
    }

    if (tool === "polygon") {
      if (!polygonPts) {
        setPolygonPts([p.x, p.y]);
      } else {
        setPolygonPts([...polygonPts, p.x, p.y]);
      }
      return;
    }

    if (tool === "erase") {
      // Find shape under cursor (works on drag too)
      onPushHistory();
      const hit = [...shapes].reverse().find((s) => hitTest(s, p));
      if (hit) setShapes(shapes.filter((s) => s.id !== hit.id));
      else {
        const pHit = [...pins].reverse().find((pn) => Math.hypot(pn.x - p.x, pn.y - p.y) < 20);
        if (pHit) setPins(pins.filter((pn) => pn.id !== pHit.id));
      }
      setDrawing({ type: "erase-drag", x: p.x, y: p.y });
      return;
    }

    if (tool === "brush") {
      onPushHistory();
      setDrawing({
        type: "brush",
        layerId: activeLayerId,
        color,
        size: brushSize,
        points: [p.x, p.y],
      });
      return;
    }

    if (tool === "rect" || tool === "circle" || tool === "ai-redraw" || tool === "grid") {
      onPushHistory();
      let drawType;
      if (tool === "ai-redraw") drawType = "ai-region";
      else if (tool === "grid") drawType = "grid";
      else drawType = tool;
      setDrawing({
        type: drawType,
        layerId: activeLayerId,
        color,
        size: brushSize,
        cellSize: Math.max(20, brushSize * 8),
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
      });
      return;
    }
  };

  const onPointerMove = (e) => {
    if (!drawing) return;
    const p = getMapCoords(e);
    if (!p) return;
    if (drawing.type === "brush") {
      setDrawing({ ...drawing, points: [...drawing.points, p.x, p.y] });
    } else {
      setDrawing({ ...drawing, w: p.x - drawing.x, h: p.y - drawing.y });
    }
  };

  const onPointerUp = () => {
    if (!drawing) return;
    if (drawing.type === "ai-region") {
      const x = Math.min(drawing.x, drawing.x + drawing.w);
      const y = Math.min(drawing.y, drawing.y + drawing.h);
      const w = Math.abs(drawing.w);
      const h = Math.abs(drawing.h);
      if (w > 10 && h > 10) {
        onAIRegionSelected({ x, y, w, h });
      }
      setDrawing(null);
      return;
    }
    if (drawing.type === "soft-erase" || drawing.type === "erase-drag") {
      setDrawing(null);
      softErasePushedRef.current = false;
      return;
    }
    if (drawing.type === "grid") {
      const x = Math.min(drawing.x, drawing.x + drawing.w);
      const y = Math.min(drawing.y, drawing.y + drawing.h);
      const w = Math.abs(drawing.w);
      const h = Math.abs(drawing.h);
      if (w > 20 && h > 20) {
        setShapes([
          ...shapes,
          { ...drawing, id: rid(), x, y, w, h },
        ]);
      }
      setDrawing(null);
      return;
    }
    if (drawing.type !== "brush") {
      // normalize rect/circle
      const x = Math.min(drawing.x, drawing.x + drawing.w);
      const y = Math.min(drawing.y, drawing.y + drawing.h);
      const w = Math.abs(drawing.w);
      const h = Math.abs(drawing.h);
      if (w < 2 && h < 2) {
        setDrawing(null);
        return;
      }
      setShapes([...shapes, { ...drawing, id: rid(), x, y, w, h }]);
    } else {
      if (drawing.points.length >= 4)
        setShapes([...shapes, { ...drawing, id: rid() }]);
    }
    setDrawing(null);
  };

  // Soft erase: filter out points within radius from brush strokes on visible+unlocked layers.
  const applySoftErase = (p) => {
    const r = Math.max(6, brushSize * 3);
    const r2 = r * r;
    const visibleLayerIds = new Set(layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
    let changed = false;
    const next = shapes
      .map((s) => {
        if (s.type !== "brush" || !visibleLayerIds.has(s.layerId)) return s;
        const newPoints = [];
        for (let i = 0; i < s.points.length; i += 2) {
          const dx = s.points[i] - p.x;
          const dy = s.points[i + 1] - p.y;
          if (dx * dx + dy * dy > r2) {
            newPoints.push(s.points[i], s.points[i + 1]);
          } else {
            changed = true;
          }
        }
        if (newPoints.length === s.points.length) return s;
        return { ...s, points: newPoints };
      })
      .filter((s) => s.type !== "brush" || s.points.length >= 4);
    if (changed) setShapes(next);
  };

  const finishPolygon = () => {
    if (!polygonPts || polygonPts.length < 6) {
      setPolygonPts(null);
      return;
    }
    onPushHistory();
    setShapes([
      ...shapes,
      {
        id: rid(),
        type: "polygon",
        layerId: activeLayerId,
        color,
        size: brushSize,
        points: polygonPts,
      },
    ]);
    setPolygonPts(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && polygonPts) finishPolygon();
      if (e.key === "Escape") {
        setPolygonPts(null);
        setTextInput(null);
        setDrawing(null);
      }
      // undo/redo shortcuts could be added at parent level
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonPts]);

  const submitText = (val) => {
    if (val && val.trim()) {
      onPushHistory();
      setShapes([
        ...shapes,
        {
          id: rid(),
          type: "text",
          layerId: activeLayerId,
          color,
          size: Math.max(brushSize * 4, 18),
          x: textInput.x,
          y: textInput.y,
          text: val.trim(),
        },
      ]);
    }
    setTextInput(null);
  };

  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));

  return (
    <div className="absolute inset-0">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.15}
        maxScale={8}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.0008, smoothStep: 0.0008, disabled: false }}
        pinch={{ step: 4 }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: false, velocityDisabled: true, excluded: ["editable-overlay"] }}
        onZoom={(ref) => setScale(ref.state.scale)}
        onZoomStop={(ref) => setScale(ref.state.scale)}
        onInit={(ref) => setScale(ref.state.scale)}
      >
        {() => (
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: W, height: H }}
          >
            <div
              className="relative shadow-2xl"
              data-canvas-content="true"
              style={{ width: W, height: H, background: "#1a1714" }}
            >
              {mapDoc.image_data ? (
                <img
                  src={mapDoc.image_data}
                  alt="map"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  style={{ imageRendering: "auto" }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-stone-500 font-display text-3xl pointer-events-none">
                  Import a map image to begin
                </div>
              )}

              {/* Shape SVG layer (only SVG types — assets/tokens/grids render as HTML below) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
              >
                {shapes
                  .filter((s) => visibleLayerIds.has(s.layerId) && !HTML_SHAPE_TYPES.has(s.type))
                  .map((s) => (
                    <ShapeEl key={s.id} s={s} />
                  ))}
                {drawing && drawing.type !== "soft-erase" && drawing.type !== "grid" && (
                  <ShapeEl s={drawing} preview />
                )}
                {drawing && drawing.type === "grid" && <GridPreview s={drawing} />}
                {polygonPts && (
                  <polyline
                    points={pairs(polygonPts).join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={brushSize}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 6"
                  />
                )}
              </svg>

              {/* HTML shape layer — assets, tokens, grids (draggable) */}
              {shapes
                .filter((s) => visibleLayerIds.has(s.layerId) && HTML_SHAPE_TYPES.has(s.type))
                .map((s) => (
                  <MoveableShape
                    key={s.id}
                    shape={s}
                    W={W}
                    H={H}
                    tool={tool}
                    readOnly={readOnly}
                    onDragEnd={(nx, ny) => {
                      onPushHistory();
                      setShapes(
                        shapes.map((sh) =>
                          sh.id === s.id ? { ...sh, x: nx, y: ny } : sh,
                        ),
                      );
                    }}
                    onClick={() => {
                      if (readOnly) return;
                      if (tool === "erase") {
                        onPushHistory();
                        setShapes(shapes.filter((sh) => sh.id !== s.id));
                      } else {
                        onShapeClick?.(s);
                      }
                    }}
                  />
                ))}

              {/* Soft-erase cursor preview */}
              {drawing && drawing.type === "soft-erase" && (
                <div
                  className="absolute pointer-events-none rounded-full border-2 border-emerald-400/60 bg-emerald-400/10"
                  style={{
                    left: drawing.x - Math.max(6, brushSize * 3),
                    top: drawing.y - Math.max(6, brushSize * 3),
                    width: Math.max(6, brushSize * 3) * 2,
                    height: Math.max(6, brushSize * 3) * 2,
                  }}
                />
              )}

              {/* Interaction overlay (transparent, captures clicks for drawing) */}
              <div
                ref={overlayRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => polygonPts && finishPolygon()}
                className={`absolute inset-0 ${interactionEnabled ? "editable-overlay" : ""}`}
                style={{
                  cursor: cursorFor(tool),
                  pointerEvents: interactionEnabled ? "auto" : "none",
                }}
                data-testid="canvas-overlay"
              />

              {/* Pins layer (rendered AFTER overlay so it sits on top and receives clicks first) */}
              {pins
                .filter((p) => !pinColorFilter || !pinColorFilter.has(p.color || "#D97706"))
                .map((p) => {
                const Icon = getPinIcon(p.icon);
                return (
                  <PinButton
                    key={p.id}
                    pin={p}
                    Icon={Icon}
                    scale={scale}
                    W={W}
                    H={H}
                    tool={tool}
                    onClick={() => {
                      if (tool === "erase") {
                        onPushHistory();
                        setPins(pins.filter((pn) => pn.id !== p.id));
                      } else {
                        onPinClick(p);
                      }
                    }}
                    onDragEnd={(nx, ny) => {
                      onPushHistory();
                      setPins(
                        pins.map((pn) =>
                          pn.id === p.id ? { ...pn, x: nx, y: ny } : pn,
                        ),
                      );
                    }}
                  />
                );
              })}

              {/* Text input overlay (also on top of canvas-overlay) */}
              {textInput && (
                <input
                  autoFocus
                  data-testid="text-tool-input"
                  className="editable-overlay absolute bg-black/70 border border-amber-600/40 text-stone-100 px-2 py-1 rounded outline-none z-10"
                  style={{
                    left: textInput.x,
                    top: textInput.y,
                    fontSize: Math.max(brushSize * 4, 18),
                    color: color,
                  }}
                  onBlur={(e) => submitText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitText(e.target.value);
                    if (e.key === "Escape") setTextInput(null);
                  }}
                  placeholder="Label…"
                />
              )}
            </div>
          </TransformComponent>
        )}
      </TransformWrapper>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-full px-3 py-2 z-30 flex items-center gap-3">
        <button
          data-testid="zoom-out-btn"
          onClick={() => transformRef.current?.zoomOut(0.15, 200)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-500 hover:bg-white/5 transition text-base leading-none"
          aria-label="Zoom out"
        >
          −
        </button>
        <input
          data-testid="zoom-slider"
          type="range"
          min={0}
          max={1000}
          value={scaleToSlider(scale)}
          onChange={(e) => {
            const nextScale = sliderToScale(parseInt(e.target.value, 10));
            const ratio = nextScale / Math.max(scale, 0.001);
            if (ratio > 1) {
              transformRef.current?.zoomIn(ratio - 1, 0);
            } else if (ratio < 1) {
              transformRef.current?.zoomOut(1 - ratio, 0);
            }
          }}
          className="zoom-slider w-44"
          aria-label="Zoom"
        />
        <button
          data-testid="zoom-in-btn"
          onClick={() => transformRef.current?.zoomIn(0.15, 200)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-500 hover:bg-white/5 transition text-base leading-none"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          data-testid="zoom-reset-btn"
          onClick={() => transformRef.current?.resetTransform(250)}
          title="Reset zoom"
          className="font-mono-cart text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber-500 px-2 py-1 rounded-full hover:bg-white/5 transition min-w-[52px] text-center"
        >
          {Math.round(scale * 100)}%
        </button>
      </div>

      {/* Hidden file input for asset import */}
      <input
        ref={assetFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="asset-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const pos = pendingAssetPosRef.current;
          e.target.value = "";
          if (!f || !pos) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const img = new Image();
            img.onload = () => {
              const maxW = 240;
              const aspect = img.naturalHeight / img.naturalWidth || 1;
              const w = Math.min(maxW, img.naturalWidth);
              const h = w * aspect;
              onPushHistory();
              setShapes((prev) => [
                ...prev,
                {
                  id: rid(),
                  type: "asset",
                  layerId: activeLayerId,
                  src: dataUrl,
                  x: pos.x - w / 2,
                  y: pos.y - h / 2,
                  w,
                  h,
                },
              ]);
              pendingAssetPosRef.current = null;
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(f);
        }}
      />
    </div>
  );
}

function GridPreview({ s }) {
  const x = Math.min(s.x, s.x + s.w);
  const y = Math.min(s.y, s.y + s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="rgba(217,119,6,0.05)"
      stroke="#D97706"
      strokeWidth={s.size || 2}
      strokeDasharray="8 6"
    />
  );
}

// Draggable HTML element rendering for assets, tokens, and grids
function MoveableShape({ shape, W, H, tool, readOnly, onDragEnd, onClick }) {
  const ref = useRef(null);
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    const target = ref.current?.closest("[data-canvas-content]");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMapX: shape.x,
      startMapY: shape.y,
      rectW: rect.width,
      rectH: rect.height,
      moved: false,
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startClientX) / d.rectW) * W;
    const dy = ((e.clientY - d.startClientY) / d.rectH) * H;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved && ref.current) {
      ref.current.style.left = `${d.startMapX + dx}px`;
      ref.current.style.top = `${d.startMapY + dy}px`;
      d.lastX = d.startMapX + dx;
      d.lastY = d.startMapY + dy;
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved && d.lastX != null) {
      onDragEnd(d.lastX, d.lastY);
    } else {
      onClick(e);
    }
  };

  const baseStyle = {
    left: shape.x,
    top: shape.y,
    width: shape.w || shape.size,
    height: shape.h || shape.size,
    cursor: tool === "erase" ? "not-allowed" : "grab",
  };

  if (shape.type === "token") {
    const sz = shape.size || 40;
    const hp = shape.hp;
    const hpMax = shape.hpMax;
    const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : null;
    const showLabel = !!shape.label;
    const showHP = hp != null && hpMax != null;
    return (
      <div
        ref={ref}
        data-testid={`token-${shape.id}`}
        className="editable-overlay absolute z-[5] select-none"
        style={{
          left: shape.x - sz / 2,
          top: shape.y - sz / 2,
          width: sz,
          height: sz,
          cursor: readOnly ? "default" : tool === "erase" ? "not-allowed" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="w-full h-full rounded-full ring-2 ring-black shadow-2xl flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: shape.color || "#EF4444" }}
        >
          {shape.label && sz >= 16 ? (
            <span
              className="font-bold text-stone-950 leading-none select-none"
              style={{
                fontSize: Math.max(7, Math.min(sz * 0.45, sz - 4)),
              }}
            >
              {shape.label.slice(0, sz >= 36 ? 4 : sz >= 24 ? 2 : 1).toUpperCase()}
            </span>
          ) : null}
        </div>
        {showHP && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-1.5 h-1 rounded-full overflow-hidden bg-black/70"
            style={{ width: Math.max(20, sz) }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${hpRatio * 100}%`,
                backgroundColor: hpRatio > 0.5 ? "#10B981" : hpRatio > 0.25 ? "#F59E0B" : "#EF4444",
              }}
            />
          </div>
        )}
        {showLabel && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-5 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-medium glass text-stone-100 pointer-events-none"
            style={{ fontSize: Math.max(9, Math.min(13, sz / 4)) }}
          >
            {shape.label}
          </div>
        )}
      </div>
    );
  }

  if (shape.type === "asset") {
    const crop = shape.cropRect || { x: 0, y: 0, w: 1, h: 1 };
    const w = shape.w;
    const h = shape.h;
    // Scale background to show only the cropped region
    const bgW = w / Math.max(0.01, crop.w);
    const bgH = h / Math.max(0.01, crop.h);
    const bgX = -crop.x * bgW;
    const bgY = -crop.y * bgH;
    return (
      <div
        ref={ref}
        data-testid={`asset-${shape.id}`}
        className="editable-overlay absolute z-[5] select-none rounded-lg overflow-hidden ring-1 ring-black/30 shadow-xl"
        style={{
          ...baseStyle,
          backgroundImage: `url(${shape.src})`,
          backgroundSize: `${bgW}px ${bgH}px`,
          backgroundPosition: `${bgX}px ${bgY}px`,
          backgroundRepeat: "no-repeat",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    );
  }

  if (shape.type === "grid") {
    const cell = shape.cellSize || 40;
    return (
      <div
        ref={ref}
        data-testid={`grid-${shape.id}`}
        className="editable-overlay absolute z-[3] select-none"
        style={{
          ...baseStyle,
          backgroundImage: `linear-gradient(${shape.color || "#D97706"}88 1px, transparent 1px), linear-gradient(90deg, ${shape.color || "#D97706"}88 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
          border: `1px solid ${shape.color || "#D97706"}66`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    );
  }

  return null;
}

function ShapeEl({ s, preview }) {
  const stroke = s.color || "#D97706";
  const sw = s.size || 4;
  const fill = "none";
  const dash = preview ? "8 6" : undefined;
  if (s.type === "brush") {
    return (
      <polyline
        points={pairs(s.points).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
    );
  }
  if (s.type === "rect") {
    return (
      <rect
        x={s.x}
        y={s.y}
        width={s.w}
        height={s.h}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
      />
    );
  }
  if (s.type === "circle") {
    const rx = Math.abs(s.w) / 2;
    const ry = Math.abs(s.h) / 2;
    return (
      <ellipse
        cx={s.x + s.w / 2}
        cy={s.y + s.h / 2}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
      />
    );
  }
  if (s.type === "polygon") {
    return (
      <polygon
        points={pairs(s.points).join(" ")}
        fill={`${stroke}22`}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
      />
    );
  }
  if (s.type === "text") {
    return (
      <text
        x={s.x}
        y={s.y}
        fill={stroke}
        fontSize={s.size}
        fontFamily="Cormorant Garamond, serif"
        fontWeight="600"
        style={{ textShadow: "0 0 6px rgba(0,0,0,0.7)" }}
      >
        {s.text}
      </text>
    );
  }
  if (s.type === "ai-region") {
    return (
      <rect
        x={s.w >= 0 ? s.x : s.x + s.w}
        y={s.h >= 0 ? s.y : s.y + s.h}
        width={Math.abs(s.w)}
        height={Math.abs(s.h)}
        fill="rgba(16,185,129,0.12)"
        stroke="#10B981"
        strokeWidth={sw}
        strokeDasharray="10 6"
      />
    );
  }
  if (s.type === "image") {
    return (
      <image
        href={s.src}
        x={s.x}
        y={s.y}
        width={s.w}
        height={s.h}
        preserveAspectRatio="none"
      />
    );
  }
  return null;
}

function pairs(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 2) out.push(`${arr[i]},${arr[i + 1]}`);
  return out;
}

function hitTest(s, p) {
  if (s.type === "rect" || s.type === "image" || s.type === "ai-region") {
    return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
  }
  if (s.type === "circle") {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const rx = Math.abs(s.w) / 2;
    const ry = Math.abs(s.h) / 2;
    if (rx === 0 || ry === 0) return false;
    return ((p.x - cx) ** 2) / (rx * rx) + ((p.y - cy) ** 2) / (ry * ry) <= 1;
  }
  if (s.type === "text") {
    const w = (s.text?.length || 0) * s.size * 0.5;
    return p.x >= s.x && p.x <= s.x + w && p.y <= s.y && p.y >= s.y - s.size;
  }
  if (s.type === "brush" || s.type === "polygon") {
    for (let i = 0; i < s.points.length; i += 2) {
      if (Math.hypot(s.points[i] - p.x, s.points[i + 1] - p.y) < (s.size || 8) + 6)
        return true;
    }
  }
  return false;
}

function cursorFor(tool) {
  if (tool === "pan") return "grab";
  if (tool === "pin") return "copy";
  if (tool === "token") return "copy";
  if (tool === "asset") return "copy";
  if (tool === "soft-erase") return "cell";
  if (tool === "erase") return "not-allowed";
  if (tool === "text") return "text";
  return "crosshair";
}

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Logarithmic slider mapping so zoom feels even across the full 0.15x → 8x range.
const MIN_S = 0.15;
const MAX_S = 8;
function scaleToSlider(s) {
  const clamped = Math.max(MIN_S, Math.min(MAX_S, s));
  return Math.round(
    ((Math.log(clamped) - Math.log(MIN_S)) / (Math.log(MAX_S) - Math.log(MIN_S))) * 1000,
  );
}
function sliderToScale(v) {
  const t = Math.max(0, Math.min(1000, v)) / 1000;
  return Math.exp(Math.log(MIN_S) + t * (Math.log(MAX_S) - Math.log(MIN_S)));
}

// Pin button with drag-to-reposition support.
// - Quick click (< 4px movement) triggers onClick (opens sheet / deletes if erase tool)
// - Drag updates position via onDragEnd (in map coordinates)
function PinButton({ pin, Icon, scale, W, H, tool, onClick, onDragEnd }) {
  const ref = useRef(null);
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    e.stopPropagation();
    const target = ref.current?.closest("[data-canvas-content]") || ref.current?.parentElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMapX: pin.x,
      startMapY: pin.y,
      mapW: W,
      mapH: H,
      rectW: rect.width,
      rectH: rect.height,
      moved: false,
      lockDrag: tool === "erase", // erase = click only, never drag
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.lockDrag) return;
    const dx = ((e.clientX - d.startClientX) / d.rectW) * d.mapW;
    const dy = ((e.clientY - d.startClientY) / d.rectH) * d.mapH;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved && ref.current) {
      const nx = d.startMapX + dx;
      const ny = d.startMapY + dy;
      ref.current.style.left = `${nx}px`;
      ref.current.style.top = `${ny}px`;
      d.lastX = nx;
      d.lastY = ny;
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved && d.lastX != null) {
      onDragEnd(d.lastX, d.lastY);
    } else {
      onClick(e);
    }
  };

  return (
    <button
      ref={ref}
      data-testid={`pin-${pin.id}`}
      className="editable-overlay absolute pin-bounce z-10 cursor-grab active:cursor-grabbing"
      style={{
        left: pin.x,
        top: pin.y,
        transform: `translate(-50%, -100%) scale(${1 / Math.max(scale, 0.3)})`,
        transformOrigin: "50% 100%",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="relative">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-xl ring-2 ring-black/40"
          style={{ backgroundColor: pin.color || "#D97706" }}
        >
          <Icon className="w-5 h-5 text-stone-950" strokeWidth={2} fill="rgba(0,0,0,0.05)" />
        </div>
        <div
          className="absolute w-3 h-3 -bottom-1 left-1/2 -translate-x-1/2 rotate-45 ring-2 ring-black/40"
          style={{ backgroundColor: pin.color || "#D97706" }}
        />
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-medium glass text-stone-100 pointer-events-none"
          style={{ display: pin.label ? "block" : "none" }}
        >
          {pin.label}
          {pin.linked_map_id && <span className="ml-1 text-amber-500">↗</span>}
        </div>
      </div>
    </button>
  );
}
