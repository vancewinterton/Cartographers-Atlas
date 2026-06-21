import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Campaigns, Maps } from "../lib/api";
import TopBar from "../components/editor/TopBar";
import ToolDock from "../components/editor/ToolDock";
import PaintPanel from "../components/editor/PaintPanel";
import PropertiesPanel from "../components/editor/PropertiesPanel";
import MapCanvas from "../components/editor/MapCanvas";
import AIRedrawDialog from "../components/editor/AIRedrawDialog";
import NestedMapSheet from "../components/editor/NestedMapSheet";
import { exportMapAsPng } from "../lib/exportMap";
import ShapeEditPopover from "../components/editor/ShapeEditPopover";
import TokenLibraryPanel from "../components/editor/TokenLibraryPanel";
import { saveToken } from "../lib/tokenLibrary";
import CombatTrackerPanel from "../components/combat/CombatTrackerPanel";
import { CombatProvider, useCombat } from "../components/combat/CombatContext";
import AdSlot from "../components/AdSlot";
import useMapPolling from "../lib/useMapPolling";
import { ChevronLeft as ChevronLeftIcon, Swords, Crosshair } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";

// Drawing shape: { id, type, layerId, color, size, points|x|y|w|h|r|text }
// Pin shape: { id, x, y, label, description, linked_map_id, color }

export default function Editor() {
  const { campaignId, mapId } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [mapDoc, setMapDoc] = useState(null);
  const [allMaps, setAllMaps] = useState([]);

  const [tool, setTool] = useState("pan"); // pan, brush, rect, circle, polygon, text, pin, ai-redraw, select-region, erase
  const [color, setColor] = useState("#D97706");
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [brushVariant, setBrushVariant] = useState("brush");
  const [paintPanelOpen, setPaintPanelOpen] = useState(false);
  const [layers, setLayers] = useState([
    { id: "L1", name: "Layer 1", visible: true, locked: false },
  ]);
  const [activeLayerId, setActiveLayerId] = useState("L1");

  const [shapes, setShapes] = useState([]);
  const [pins, setPins] = useState([]);

  const [selectedPin, setSelectedPin] = useState(null);
  const [aiRegion, setAiRegion] = useState(null); // {x,y,w,h, imageDataURL}
  const [nestedSheetOpen, setNestedSheetOpen] = useState(false);
  const [pinColorFilter, setPinColorFilter] = useState(new Set());
  const [pendingDeletePin, setPendingDeletePin] = useState(null);
  const [editingShape, setEditingShape] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [showTokenLabels, setShowTokenLabels] = useState(true);
  const [showHealthBars, setShowHealthBars] = useState(true);
  const [showGhostTrails, setShowGhostTrails] = useState(true);
  const [combatOpen, setCombatOpen] = useState(false);
  const [pendingDamage, setPendingDamage] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPrefill, setLibraryPrefill] = useState(null);

  // Wrap setTool so picking any tool auto-reopens the properties panel
  const setToolAndReopen = (t) => {
    setTool(t);
    setPropertiesOpen(true);
  };

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const skipNextHistory = useRef(false);

  // Real-time sync watermarks (bidirectional polling with viewers / co-DMs)
  const [mapUpdatedAt, setMapUpdatedAt] = useState(null);
  const combatDispatchRef = useRef(null);
  const lastLocalEditRef = useRef(0);
  const lastSavedTsRef = useRef(null);
  const skipNextAutosaveRef = useRef(false);

  const addTokensToCombat = (tokenShapes) => {
    const tokens = (tokenShapes || []).filter((s) => s.type === "token");
    if (!tokens.length) {
      toast.error("Select a token to add to the tracker");
      return;
    }
    combatDispatchRef.current?.({ type: "IMPORT_FROM_MAP", tokens });
    setCombatOpen(true);
    toast.success(
      `Added ${tokens.length} token${tokens.length === 1 ? "" : "s"} to combat tracker`,
    );
  };

  // Drop a saved library token onto the centre of the current map
  const addLibraryToken = (tpl) => {
    pushHistory();
    const id = cryptoRandom();
    setShapes((arr) => [
      ...arr,
      {
        id,
        type: "token",
        layerId: activeLayerId,
        color: tpl.color || "#3B82F6",
        size: tpl.size || 40,
        x: Math.round((mapDoc.image_width || 1600) / 2),
        y: Math.round((mapDoc.image_height || 1000) / 2),
        label: tpl.label || "",
        description: tpl.description || "",
        hp: tpl.hp ?? null,
        hpMax: tpl.hpMax ?? null,
        ac: tpl.ac ?? null,
        initBonus: tpl.initBonus ?? 0,
        attacks: Array.isArray(tpl.attacks) ? tpl.attacks : [],
      },
    ]);
    toast.success(`Added ${tpl.label || "token"} to map`);
  };

  const saveTokenToLibrary = (s) => {
    if (!s || s.type !== "token") return;
    saveToken({
      label: s.label || "Token",
      description: s.description || "",
      color: s.color,
      size: s.size,
      hp: s.hp,
      hpMax: s.hpMax,
      ac: s.ac,
      initBonus: s.initBonus,
      attacks: s.attacks,
    });
    toast.success(`Saved "${s.label || "token"}" to your library`);
  };

  const setBlankCanvas = async () => {
    if (!mapDoc) return;
    const W = mapDoc.image_width || 1600;
    const H = mapDoc.image_height || 1000;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d");
    cx.fillStyle = "#ffffff";
    cx.fillRect(0, 0, W, H);
    const dataUrl = c.toDataURL("image/png");
    try {
      const updated = await Maps.update(mapDoc.id, {
        image_data: dataUrl,
        image_width: W,
        image_height: H,
      });
      setMapDoc(updated);
      toast.success("Blank canvas ready");
    } catch {
      toast.error("Could not create blank canvas");
    }
  };

  // Load
  useEffect(() => {
    (async () => {
      try {
        const c = await Campaigns.get(campaignId);
        setCampaign(c);
        const maps = await Campaigns.maps(campaignId);
        setAllMaps(maps);
        let m;
        if (mapId) m = await Maps.get(mapId);
        else m = await Campaigns.rootMap(campaignId);
        loadMap(m);
      } catch (e) {
        toast.error("Failed to load campaign");
        navigate("/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, mapId]);

  const loadMap = (m) => {
    setMapDoc(m);
    setShapes(m.layers?.flatMap((l) => l.shapes || []) || []);
    setPins(m.pins || []);
    const ls =
      m.layers && m.layers.length
        ? m.layers.map((l) => ({
            id: l.id,
            name: l.name,
            visible: l.visible !== false,
            locked: !!l.locked,
          }))
        : [{ id: "L1", name: "Layer 1", visible: true, locked: false }];
    setLayers(ls);
    setActiveLayerId(ls[0].id);
    setMapUpdatedAt(m.updated_at || null);
    lastSavedTsRef.current = m.updated_at || null;
    lastLocalEditRef.current = 0;
    undoStack.current = [];
    redoStack.current = [];
  };

  // Push to undo on any change (except programmatic)
  const pushHistory = useCallback(() => {
    if (skipNextHistory.current) {
      skipNextHistory.current = false;
      return;
    }
    undoStack.current.push({
      shapes: JSON.parse(JSON.stringify(shapes)),
      pins: JSON.parse(JSON.stringify(pins)),
    });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, [shapes, pins]);

  const undo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop();
    redoStack.current.push({
      shapes: JSON.parse(JSON.stringify(shapes)),
      pins: JSON.parse(JSON.stringify(pins)),
    });
    skipNextHistory.current = true;
    setShapes(prev.shapes);
    setPins(prev.pins);
  };

  const redo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    undoStack.current.push({
      shapes: JSON.parse(JSON.stringify(shapes)),
      pins: JSON.parse(JSON.stringify(pins)),
    });
    skipNextHistory.current = true;
    setShapes(next.shapes);
    setPins(next.pins);
  };

  // Save
  const save = async () => {
    if (!mapDoc) return;
    const layersOut = layers.map((l) => ({
      ...l,
      shapes: shapes.filter((s) => s.layerId === l.id),
    }));
    try {
      await Maps.update(mapDoc.id, { layers: layersOut, pins });
      toast.success("Map saved");
    } catch (e) {
      toast.error("Save failed");
    }
  };

  // Autosave debounced + remote-sync watermarking
  useEffect(() => {
    if (!mapDoc) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    lastLocalEditRef.current = Date.now();
    const t = setTimeout(async () => {
      const layersOut = layers.map((l) => ({
        ...l,
        shapes: shapes.filter((s) => s.layerId === l.id),
      }));
      try {
        const saved = await Maps.update(mapDoc.id, { layers: layersOut, pins });
        lastSavedTsRef.current = saved.updated_at;
        setMapUpdatedAt(saved.updated_at);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, pins, layers]);

  // Pull in changes made by viewers / co-DMs (skip while the local user is editing)
  const applyRemoteMap = useCallback(
    (fresh) => {
      if (!fresh || !mapDoc || fresh.id !== mapDoc.id) return;
      if (fresh.updated_at && fresh.updated_at === lastSavedTsRef.current) return;
      if (Date.now() - lastLocalEditRef.current < 1200) return;
      skipNextAutosaveRef.current = true;
      setShapes(fresh.layers?.flatMap((l) => l.shapes || []) || []);
      setPins(fresh.pins || []);
      lastSavedTsRef.current = fresh.updated_at || null;
      setMapUpdatedAt(fresh.updated_at || null);
    },
    [mapDoc],
  );

  useMapPolling({
    mapId: mapDoc?.id,
    localUpdatedAt: mapUpdatedAt,
    onUpdate: applyRemoteMap,
    intervalMs: 1200,
  });

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;

      // Bulk delete / duplicate selection
      if (selectedIds && selectedIds.size > 0) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          pushHistory();
          setShapes((arr) => arr.filter((s) => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
          return;
        }
        if (mod && e.key.toLowerCase() === "d") {
          e.preventDefault();
          pushHistory();
          const newIds = new Set();
          setShapes((arr) => {
            const additions = arr
              .filter((s) => selectedIds.has(s.id))
              .map((s) => {
                const id = cryptoRandom();
                newIds.add(id);
                return {
                  ...s,
                  id,
                  x: (s.x || 0) + 30,
                  y: (s.y || 0) + 30,
                  trail: undefined,
                };
              });
            return [...arr, ...additions];
          });
          setTimeout(() => setSelectedIds(newIds), 0);
          return;
        }
        if (e.key === "Escape") {
          setSelectedIds(new Set());
        }
      }

      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onImportImage = async (file) => {
    if (!file || !mapDoc) return;
    const dataUrl = await fileToDataURL(file);
    const img = new Image();
    img.onload = async () => {
      const updated = await Maps.update(mapDoc.id, {
        image_data: dataUrl,
        image_width: img.width,
        image_height: img.height,
      });
      setMapDoc(updated);
      toast.success("Map image imported");
    };
    img.src = dataUrl;
  };

  const openPinSheet = (pin) => {
    setSelectedPin(pin);
    setNestedSheetOpen(true);
  };

  const updatePin = (pinId, patch) => {
    pushHistory();
    setPins((ps) => ps.map((p) => (p.id === pinId ? { ...p, ...patch } : p)));
    setSelectedPin((sp) => (sp && sp.id === pinId ? { ...sp, ...patch } : sp));
  };

  const deletePin = (pinId) => {
    const p = pins.find((pn) => pn.id === pinId);
    if (!p) return;
    const hasContent =
      (p.label && p.label.trim() && p.label !== "New Pin") ||
      (p.description && p.description.trim()) ||
      p.image ||
      p.linked_map_id;
    if (hasContent) {
      setPendingDeletePin(p);
      return;
    }
    confirmDeletePin(pinId);
  };

  const confirmDeletePin = (pinId) => {
    pushHistory();
    setPins((ps) => ps.filter((p) => p.id !== pinId));
    setNestedSheetOpen(false);
    setPendingDeletePin(null);
  };

  const createLinkedMap = async (pin, name) => {
    const m = await Maps.create({
      campaign_id: campaignId,
      name: name || `${pin.label || "Sub"} Map`,
      parent_map_id: mapDoc.id,
      parent_pin_id: pin.id,
    });
    updatePin(pin.id, { linked_map_id: m.id });
    const maps = await Campaigns.maps(campaignId);
    setAllMaps(maps);
    toast.success("Linked sub-map created");
    return m;
  };

  if (!campaign || !mapDoc) {
    return (
      <div className="h-screen flex items-center justify-center text-stone-500 font-mono-cart">
        Loading map…
      </div>
    );
  }

  return (
    <CombatProvider key={campaignId} storageKey={`combat_state_${campaignId}`}>
    <CombatDispatchBridge dispatchRef={combatDispatchRef} />
    <CombatStateBridge onPendingDamage={setPendingDamage} />
    <div
      className="h-screen w-screen overflow-hidden canvas-bg relative"
      data-testid="editor-page"
    >
      <MapCanvas
        mapDoc={mapDoc}
        tool={tool}
        color={color}
        brushSize={brushSize}
        brushOpacity={brushOpacity}
        brushVariant={brushVariant}
        shapes={shapes}
        setShapes={setShapes}
        pins={pins}
        setPins={setPins}
        layers={layers}
        activeLayerId={activeLayerId}
        onPushHistory={pushHistory}
        onPinClick={openPinSheet}
        onAIRegionSelected={setAiRegion}
        pinColorFilter={pinColorFilter}
        onShapeClick={(s) => {
          if (pendingDamage && s.type === "token") {
            combatDispatchRef.current?.({ type: "APPLY_DAMAGE_TO_TOKEN", tokenId: s.id });
            toast.success(`Applied ${pendingDamage.amount} damage to ${s.label || "token"}`);
            return;
          }
          setEditingShape(s);
        }}
        showTokenLabels={showTokenLabels}
        showHealthBars={showHealthBars}
        showGhostTrails={showGhostTrails}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onSetBlank={setBlankCanvas}
      />

      <TopBar
        campaign={campaign}
        mapDoc={mapDoc}
        allMaps={allMaps}
        onHome={() => navigate("/")}
        onSave={save}
        onImport={onImportImage}
        onSwitchMap={(id) => navigate(`/campaign/${campaignId}/map/${id}`)}
        onExport={() => exportMapAsPng(mapDoc, shapes, pins, layers, campaign.name)}
        onToggleCombat={() => setCombatOpen((v) => !v)}
        combatOpen={combatOpen}
        onToggleLibrary={() => setLibraryOpen((v) => !v)}
        libraryOpen={libraryOpen}
      />

      <ToolDock
        tool={tool}
        setTool={setToolAndReopen}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.current.length > 0}
        canRedo={redoStack.current.length > 0}
        onOpenPaintPanel={() => setPaintPanelOpen(true)}
      />

      {/* Editor menu ad — fills the empty top-center space on wide screens */}
      <div className="hidden xl:block absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[300px] pointer-events-auto">
        <AdSlot
          orientation="horizontal"
          dismissible
          testId="editor-ad-top"
          className="glass !border-white/10 h-[48px]"
        />
      </div>

      {pendingDamage && (
        <div
          data-testid="damage-targeting-banner"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-4 py-2 flex items-center gap-3 ring-1 ring-amber-500/40 animate-pulse"
        >
          <Crosshair className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-stone-100">
            Click a token to apply{" "}
            <span className="font-bold text-amber-400">{pendingDamage.amount}</span> damage
          </span>
          <button
            data-testid="cancel-damage-targeting"
            onClick={() => combatDispatchRef.current?.({ type: "DISARM_DAMAGE" })}
            className="text-xs text-stone-400 hover:text-stone-100 underline"
          >
            cancel
          </button>
        </div>
      )}

      {paintPanelOpen && (
        <PaintPanel
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          brushOpacity={brushOpacity}
          setBrushOpacity={setBrushOpacity}
          brushVariant={brushVariant}
          setBrushVariant={setBrushVariant}
          onClose={() => setPaintPanelOpen(false)}
        />
      )}

      {propertiesOpen ? (
        <PropertiesPanel
          tool={tool}
          color={color}
          setColor={setColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          layers={layers}
          setLayers={setLayers}
          activeLayerId={activeLayerId}
          setActiveLayerId={setActiveLayerId}
          shapes={shapes}
          setShapes={setShapes}
          pins={pins}
          pinColorFilter={pinColorFilter}
          setPinColorFilter={setPinColorFilter}
          showTokenLabels={showTokenLabels}
          setShowTokenLabels={setShowTokenLabels}
          showHealthBars={showHealthBars}
          setShowHealthBars={setShowHealthBars}
          showGhostTrails={showGhostTrails}
          setShowGhostTrails={setShowGhostTrails}
          campaign={campaign}
          setCampaign={async (patch) => {
            // optimistic update + persist to backend
            const next = { ...campaign, ...patch };
            setCampaign(next);
            try {
              await Campaigns.update(campaign.id, patch);
            } catch {
              toast.error("Failed to save campaign setting");
              setCampaign(campaign);
            }
          }}
          onClose={() => setPropertiesOpen(false)}
        />
      ) : (
        <button
          data-testid="properties-reopen"
          onClick={() => setPropertiesOpen(true)}
          title="Show stroke panel"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 glass rounded-2xl px-3 py-3 text-stone-300 hover:text-amber-500 hover:bg-white/5 transition flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="font-mono-cart text-[10px] uppercase tracking-widest">Panel</span>
        </button>
      )}

      {libraryOpen && (
        <TokenLibraryPanel
          prefill={libraryPrefill}
          onClose={() => {
            setLibraryOpen(false);
            setLibraryPrefill(null);
          }}
          onAddToken={(tpl) => addLibraryToken(tpl)}
        />
      )}

      {combatOpen && (
        <CombatTrackerPanel
          onClose={() => setCombatOpen(false)}
          mapShapes={shapes}
          onSpawnToken={(t) => {
            // Place a new token at the center of the map; return its id so the
            // combatant can link to it via sourceTokenId.
            pushHistory();
            const id = cryptoRandom();
            const newToken = {
              id,
              type: "token",
              layerId: activeLayerId,
              color: t.color,
              size: 28,
              x: Math.round((mapDoc.image_width || 1600) / 2),
              y: Math.round((mapDoc.image_height || 1000) / 2),
              label: t.label || "",
              hp: t.hp ?? null,
              hpMax: t.hpMax ?? null,
              ac: t.ac ?? null,
              initBonus: t.initBonus ?? 0,
              attacks: [],
            };
            setShapes((arr) => [...arr, newToken]);
            toast.success(`Token added to map for ${t.label || "combatant"}`);
            return id;
          }}
          onFocusToken={(tokenId) => {
            const tok = shapes.find((s) => s.id === tokenId);
            if (!tok) {
              toast.error("Linked token not found on this map");
              return;
            }
            setEditingShape(tok);
            setSelectedIds(new Set([tokenId]));
          }}
        />
      )}

      {selectedIds && selectedIds.size > 0 && (
        <div
          data-testid="selection-actionbar"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 glass rounded-2xl px-3 py-2 flex items-center gap-2"
        >
          <span className="font-mono-cart text-[10px] uppercase tracking-widest text-stone-400 px-1">
            {selectedIds.size} selected
          </span>
          <div className="h-5 w-px bg-white/10" />
          {selectedIds.size === 1 && (
            <button
              data-testid="bulk-edit"
              onClick={() => {
                const id = [...selectedIds][0];
                const s = shapes.find((sh) => sh.id === id);
                if (s) setEditingShape(s);
              }}
              className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-amber-500/10 hover:text-amber-500 text-stone-200 text-xs font-medium transition"
            >
              Edit
            </button>
          )}
          <button
            data-testid="bulk-hide"
            onClick={() => {
              pushHistory();
              const anyVisible = shapes.some((s) => selectedIds.has(s.id) && !s.hidden);
              setShapes((arr) =>
                arr.map((s) => (selectedIds.has(s.id) ? { ...s, hidden: anyVisible } : s)),
              );
            }}
            className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-amber-500/10 hover:text-amber-500 text-stone-200 text-xs font-medium transition"
          >
            Hide / Show
          </button>
          {shapes.some((s) => selectedIds.has(s.id) && s.type === "token") && (
            <button
              data-testid="bulk-add-combat"
              onClick={() =>
                addTokensToCombat(shapes.filter((s) => selectedIds.has(s.id)))
              }
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" /> Add to Combat
            </button>
          )}
          <button
            data-testid="bulk-duplicate"
            onClick={() => {
              pushHistory();
              const newIds = new Set();
              setShapes((arr) => {
                const copies = arr
                  .filter((s) => selectedIds.has(s.id))
                  .map((s) => {
                    const id = cryptoRandom();
                    newIds.add(id);
                    return {
                      ...s,
                      id,
                      x: (s.x || 0) + 30,
                      y: (s.y || 0) + 30,
                      trail: undefined,
                    };
                  });
                return [...arr, ...copies];
              });
              setTimeout(() => setSelectedIds(newIds), 0);
            }}
            className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-amber-500/10 hover:text-amber-500 text-stone-200 text-xs font-medium transition"
          >
            Duplicate
          </button>
          <button
            data-testid="bulk-delete"
            onClick={() => {
              pushHistory();
              setShapes((arr) => arr.filter((s) => !selectedIds.has(s.id)));
              setSelectedIds(new Set());
            }}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium transition"
          >
            Delete
          </button>
          <button
            data-testid="bulk-clear"
            onClick={() => setSelectedIds(new Set())}
            className="px-2 py-1.5 text-stone-500 hover:text-stone-200 text-xs transition"
            title="Clear selection (Esc)"
          >
            ✕
          </button>
        </div>
      )}

      {aiRegion && (
        <AIRedrawDialog
          region={aiRegion}
          mapDoc={mapDoc}
          onClose={() => setAiRegion(null)}
          onComplete={(imageDataUrl) => {
            // Add as an image shape on canvas at the region location
            pushHistory();
            setShapes((s) => [
              ...s,
              {
                id: cryptoRandom(),
                type: "image",
                layerId: activeLayerId,
                x: aiRegion.x,
                y: aiRegion.y,
                w: aiRegion.w,
                h: aiRegion.h,
                src: imageDataUrl,
              },
            ]);
            setAiRegion(null);
            toast.success("AI region added");
          }}
        />
      )}

      <NestedMapSheet
        open={nestedSheetOpen}
        onOpenChange={setNestedSheetOpen}
        pin={selectedPin}
        allMaps={allMaps}
        campaignId={campaignId}
        onUpdate={(patch) => selectedPin && updatePin(selectedPin.id, patch)}
        onDelete={() => selectedPin && deletePin(selectedPin.id)}
        onCreateLinkedMap={(name) =>
          selectedPin && createLinkedMap(selectedPin, name)
        }
        onOpenMap={(id) => {
          setNestedSheetOpen(false);
          navigate(`/campaign/${campaignId}/map/${id}`);
        }}
      />

      <AlertDialog
        open={!!pendingDeletePin}
        onOpenChange={(o) => !o && setPendingDeletePin(null)}
      >
        <AlertDialogContent
          data-testid="confirm-delete-pin-dialog"
          className="bg-[#1E1B18] border-white/10"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              Delete &ldquo;{pendingDeletePin?.label || "this pin"}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-400">
              This pin has notes
              {pendingDeletePin?.image ? ", an attached image" : ""}
              {pendingDeletePin?.linked_map_id
                ? ", and a linked sub-map"
                : ""}
              . Deleting it is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirm-delete-pin-cancel"
              className="bg-transparent border-white/10 hover:bg-white/5"
            >
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-pin-confirm"
              onClick={() => confirmDeletePin(pendingDeletePin.id)}
              className="bg-red-600 hover:bg-red-500 text-stone-50"
            >
              Delete pin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingShape && (
        <ShapeEditPopover
          shape={editingShape}
          onClose={() => setEditingShape(null)}
          onAddToCombat={() => addTokensToCombat([editingShape])}
          onSaveToLibrary={() => saveTokenToLibrary(editingShape)}
          onUpdate={(patch) => {
            setShapes((arr) =>
              arr.map((s) => (s.id === editingShape.id ? { ...s, ...patch } : s)),
            );
            setEditingShape((cur) => (cur ? { ...cur, ...patch } : cur));
          }}
          onDuplicate={() => {
            pushHistory();
            const copy = {
              ...editingShape,
              id: cryptoRandom(),
              x: (editingShape.x || 0) + 30,
              y: (editingShape.y || 0) + 30,
              trail: undefined,
            };
            setShapes((arr) => [...arr, copy]);
            setEditingShape(copy);
            toast.success(`${editingShape.type === "token" ? "Token" : editingShape.type === "asset" ? "Asset" : "Grid"} duplicated`);
          }}
          onDelete={() => {
            pushHistory();
            setShapes((arr) => arr.filter((s) => s.id !== editingShape.id));
            setEditingShape(null);
          }}
        />
      )}
    </div>
    </CombatProvider>
  );
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Captures the combat reducer dispatch so the editor (outside the provider's
// consumer tree) can push selected map tokens into the tracker.
function CombatDispatchBridge({ dispatchRef }) {
  const { dispatch } = useCombat();
  dispatchRef.current = dispatch;
  return null;
}

// Lifts the combat tracker's pendingDamage (map-click targeting) up to the
// editor so token clicks can apply damage and a targeting banner can show.
function CombatStateBridge({ onPendingDamage }) {
  const { state } = useCombat();
  useEffect(() => {
    onPendingDamage(state.pendingDamage || null);
  }, [state.pendingDamage, onPendingDamage]);
  return null;
}
