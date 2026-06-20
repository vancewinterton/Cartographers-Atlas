import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Share as ShareAPI, Maps } from "../lib/api";
import MapCanvas from "../components/editor/MapCanvas";
import PaintPanel from "../components/editor/PaintPanel";
import TokenLibraryPanel from "../components/editor/TokenLibraryPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Compass, MapPinned, ArrowUpRight, ExternalLink, Wifi, Hand, Paintbrush, Library } from "lucide-react";
import { Button } from "../components/ui/button";
import useMapPolling from "../lib/useMapPolling";

const PAINT_TOOLS = new Set(["brush", "soft-erase", "erase"]);

export default function SharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [pinSheetPin, setPinSheetPin] = useState(null);
  // localShapes lets viewers drag tokens optimistically before the server confirms
  const [localShapes, setLocalShapes] = useState(null);
  const [synced, setSynced] = useState(true);
  const saveTimer = useRef(null);
  const draggingRef = useRef(false);

  // Viewer paint state — players can draw on the shared map and it syncs to the DM.
  const [viewerTool, setViewerTool] = useState("pan");
  const [paintColor, setPaintColor] = useState("#D97706");
  const [brushSize, setBrushSize] = useState(6);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [brushVariant, setBrushVariant] = useState("brush");
  const [paintOpen, setPaintOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    ShareAPI.get(token)
      .then((d) => {
        setData(d);
        const root = (d.maps || []).find((m) => !m.parent_map_id);
        setCurrentMapId(root?.id || d.maps?.[0]?.id);
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || "Shared campaign not found");
      });
  }, [token]);

  const currentMap = data?.maps?.find((m) => m.id === currentMapId) || null;
  const serverShapes = useMemo(
    () => (currentMap?.layers || []).flatMap((l) => l.shapes || []),
    [currentMap]
  );
  const allShapes = localShapes ?? serverShapes;

  // Reset local shapes whenever the current map changes
  useEffect(() => {
    setLocalShapes(null);
  }, [currentMapId]);

  // Apply a fresh map snapshot from the server (from polling) into local state.
  const applyFreshMap = (mapDoc) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        maps: prev.maps.map((m) => (m.id === mapDoc.id ? mapDoc : m)),
      };
    });
    // Discard local overlay only if viewer is not in the middle of a drag
    if (!draggingRef.current) setLocalShapes(null);
    setSynced(true);
  };

  useMapPolling({
    mapId: currentMapId,
    localUpdatedAt: currentMap?.updated_at,
    onUpdate: applyFreshMap,
    intervalMs: 1200,
    paused: false,
  });

  // Persist local shape changes (e.g. after a token drag) back to the server.
  const persistShapes = (nextShapes) => {
    if (!currentMap) return;
    const baseLayers =
      currentMap.layers && currentMap.layers.length
        ? currentMap.layers
        : [{ id: "L1", name: "Layer 1", visible: true, locked: false }];
    const firstId = baseLayers[0].id;
    const layersOut = baseLayers.map((l, idx) => ({
      ...l,
      shapes: nextShapes.filter(
        (s) => (s.layerId || firstId) === l.id || (idx === 0 && !s.layerId),
      ),
    }));
    setSynced(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await Maps.update(currentMap.id, { layers: layersOut });
        // Server bumps updated_at; merge it so polling doesn't re-fetch the same rev.
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            maps: prev.maps.map((m) => (m.id === saved.id ? saved : m)),
          };
        });
        setSynced(true);
      } catch {
        setSynced(false);
      }
    }, 250);
  };

  // Add a saved library token onto the shared map (persists + syncs to the DM)
  const addLibraryToken = (tpl) => {
    if (!currentMap) return;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const firstLayer =
      (currentMap.layers && currentMap.layers.length && currentMap.layers[0].id) || "L1";
    const next = [
      ...allShapes,
      {
        id,
        type: "token",
        layerId: firstLayer,
        color: tpl.color || "#3B82F6",
        size: tpl.size || 40,
        x: Math.round((currentMap.image_width || 1600) / 2),
        y: Math.round((currentMap.image_height || 1000) / 2),
        label: tpl.label || "",
        description: tpl.description || "",
        hp: tpl.hp ?? null,
        hpMax: tpl.hpMax ?? null,
        ac: tpl.ac ?? null,
        initBonus: tpl.initBonus ?? 0,
        attacks: Array.isArray(tpl.attacks) ? tpl.attacks : [],
      },
    ];
    draggingRef.current = true;
    setLocalShapes(next);
    persistShapes(next);
    setTimeout(() => {
      draggingRef.current = false;
    }, 1200);
  };

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-4">
        <Compass className="w-12 h-12 text-amber-600/60 mb-4" />
        <h1 className="font-display text-4xl text-stone-200">Map not found</h1>
        <p className="text-stone-500 mt-2 text-sm">{error}</p>
      </div>
    );
  }
  if (!data || !currentMapId || !currentMap) {
    return (
      <div className="h-screen flex items-center justify-center text-stone-500 font-mono-cart">
        Loading shared atlas…
      </div>
    );
  }

  const layers = (currentMap.layers || []).length
    ? currentMap.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible !== false,
        locked: !!l.locked,
      }))
    : [{ id: "L1", name: "Layer 1", visible: true, locked: false }];

  return (
    <div
      className="h-screen w-screen overflow-hidden canvas-bg relative"
      data-testid="share-page"
    >
      <MapCanvas
        mapDoc={currentMap}
        tool={viewerTool}
        color={paintColor}
        brushSize={brushSize}
        brushOpacity={brushOpacity}
        brushVariant={brushVariant}
        shapes={allShapes}
        setShapes={(updater) => {
          // setShapes may be called with either an updater fn or the new array
          const next =
            typeof updater === "function" ? updater(allShapes) : updater;
          draggingRef.current = true;
          setLocalShapes(next);
          persistShapes(next);
          // unlock polling overrides shortly after the drag ends
          setTimeout(() => {
            draggingRef.current = false;
          }, 1200);
        }}
        pins={currentMap.pins || []}
        setPins={() => {}}
        layers={layers}
        activeLayerId={layers[0].id}
        onPushHistory={() => {}}
        onPinClick={(p) => setPinSheetPin(p)}
        onAIRegionSelected={() => {}}
        pinColorFilter={new Set()}
        showHealthBars={data.campaign.hp_bars_public !== false}
        readOnly
        viewerCanDragTokens
      />

      {/* Viewer paint dock — players can draw and it syncs back to the DM */}
      <div
        data-testid="viewer-tool-dock"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 glass rounded-2xl p-2 flex flex-col gap-1"
      >
        <button
          data-testid="viewer-tool-pan"
          onClick={() => setViewerTool("pan")}
          title="Pan / Move tokens"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            viewerTool === "pan"
              ? "bg-white/10 text-amber-500 ring-1 ring-amber-600/30"
              : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
        <button
          data-testid="viewer-tool-paint"
          onClick={() => {
            setPaintOpen(true);
            if (!PAINT_TOOLS.has(viewerTool)) setViewerTool("brush");
          }}
          title="Paint tools"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            PAINT_TOOLS.has(viewerTool)
              ? "bg-white/10 text-amber-500 ring-1 ring-amber-600/30"
              : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
          }`}
        >
          <Paintbrush className="w-4 h-4" />
        </button>
        <button
          data-testid="viewer-tool-library"
          onClick={() => setLibraryOpen((v) => !v)}
          title="My token library"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            libraryOpen
              ? "bg-white/10 text-amber-500 ring-1 ring-amber-600/30"
              : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
          }`}
        >
          <Library className="w-4 h-4" />
        </button>
      </div>

      {libraryOpen && (
        <TokenLibraryPanel
          onClose={() => setLibraryOpen(false)}
          onAddToken={(tpl) => addLibraryToken(tpl)}
        />
      )}

      {paintOpen && (
        <PaintPanel
          tool={viewerTool}
          setTool={setViewerTool}
          color={paintColor}
          setColor={setPaintColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          brushOpacity={brushOpacity}
          setBrushOpacity={setBrushOpacity}
          brushVariant={brushVariant}
          setBrushVariant={setBrushVariant}
          onClose={() => setPaintOpen(false)}
        />
      )}

      {/* Floating share header */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div
          data-testid="share-header"
          className="glass rounded-2xl px-4 py-2 flex items-center gap-3 pointer-events-auto"
        >
          <Compass className="w-4 h-4 text-amber-500" />
          <div className="flex flex-col leading-tight">
            <span className="font-mono-cart text-[10px] uppercase tracking-widest text-stone-500">
              {data.campaign.name}
            </span>
            <span className="font-display text-lg text-stone-100">
              {currentMap.name}
            </span>
          </div>
          <span className="ml-3 px-2 py-0.5 rounded-full bg-amber-600/10 text-amber-500 font-mono-cart text-[9px] uppercase tracking-wider border border-amber-700/30">
            Player View
          </span>
          <span
            data-testid="share-sync-status"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono-cart text-[9px] uppercase tracking-wider border ${
              synced
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-700/30"
                : "bg-amber-500/10 text-amber-400 border-amber-700/30 animate-pulse"
            }`}
            title={synced ? "Synced with DM" : "Syncing…"}
          >
            <Wifi className="w-2.5 h-2.5" />
            {synced ? "Live" : "Sync…"}
          </span>
        </div>
      </div>

      {/* Maps navigator */}
      {data.maps.length > 1 && (
        <div className="absolute top-4 right-4 z-30 glass rounded-2xl p-3 max-w-[280px] pointer-events-auto">
          <div className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">
            Maps
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {data.maps.map((m) => (
              <button
                key={m.id}
                data-testid={`share-map-${m.id}`}
                onClick={() => setCurrentMapId(m.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition text-left ${
                  m.id === currentMapId
                    ? "bg-amber-600/15 text-amber-500 ring-1 ring-amber-700/30"
                    : "text-stone-300 hover:bg-white/5"
                }`}
              >
                <MapPinned className="w-3.5 h-3.5 opacity-60 shrink-0" />
                <span className="text-sm flex-1 truncate">{m.name}</span>
                {m.parent_map_id && (
                  <span className="font-mono-cart text-[9px] text-stone-500 uppercase">sub</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 glass rounded-full px-4 py-1.5 text-[10px] font-mono-cart uppercase tracking-widest text-stone-400 pointer-events-none">
        🖐 Drag heroes & enemies · Pan with empty space · Click pins for details
      </div>

      {/* Pin details (read-only) */}
      <Sheet open={!!pinSheetPin} onOpenChange={(o) => !o && setPinSheetPin(null)}>
        <SheetContent
          data-testid="share-pin-sheet"
          side="right"
          className="bg-[#1E1B18] border-white/10 text-stone-100 w-[400px] sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="font-display text-3xl">
              {pinSheetPin?.label || "Pin"}
            </SheetTitle>
          </SheetHeader>
          {pinSheetPin?.image && (
            <img
              src={pinSheetPin.image}
              alt="pin"
              className="mt-4 w-full max-h-60 object-cover rounded-xl"
            />
          )}
          {pinSheetPin?.description && (
            <p className="text-stone-300 mt-4 leading-relaxed whitespace-pre-wrap text-sm">
              {pinSheetPin.description}
            </p>
          )}
          {pinSheetPin?.linked_map_id && (
            <Button
              data-testid="share-open-linked-map"
              onClick={() => {
                setCurrentMapId(pinSheetPin.linked_map_id);
                setPinSheetPin(null);
              }}
              className="mt-6 w-full bg-amber-600 hover:bg-amber-500 text-stone-950"
            >
              Open linked map <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </SheetContent>
      </Sheet>

      <a
        href="/"
        className="absolute bottom-4 right-4 z-30 glass rounded-full px-3 py-1.5 text-xs text-stone-400 hover:text-amber-500 flex items-center gap-1.5 transition"
      >
        <ExternalLink className="w-3 h-3" /> Make your own atlas
      </a>
    </div>
  );
}
