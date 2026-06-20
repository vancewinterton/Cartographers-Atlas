import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Campaigns, Maps } from "../lib/api";
import TopBar from "../components/editor/TopBar";
import ToolDock from "../components/editor/ToolDock";
import PropertiesPanel from "../components/editor/PropertiesPanel";
import MapCanvas from "../components/editor/MapCanvas";
import AIRedrawDialog from "../components/editor/AIRedrawDialog";
import NestedMapSheet from "../components/editor/NestedMapSheet";
import { exportMapAsPng } from "../lib/exportMap";
import ShapeEditPopover from "../components/editor/ShapeEditPopover";
import CombatTrackerPanel from "../components/combat/CombatTrackerPanel";
import { CombatProvider } from "../components/combat/CombatContext";
import { ChevronLeft as ChevronLeftIcon } from "lucide-react";
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

  // Wrap setTool so picking any tool auto-reopens the properties panel
  const setToolAndReopen = (t) => {
    setTool(t);
    setPropertiesOpen(true);
  };

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const skipNextHistory = useRef(false);

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

  // Autosave debounced
  useEffect(() => {
    if (!mapDoc) return;
    const t = setTimeout(() => {
      const layersOut = layers.map((l) => ({
        ...l,
        shapes: shapes.filter((s) => s.layerId === l.id),
      }));
      Maps.update(mapDoc.id, { layers: layersOut, pins }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, pins, layers]);

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
    <div
      className="h-screen w-screen overflow-hidden canvas-bg relative"
      data-testid="editor-page"
    >
      <MapCanvas
        mapDoc={mapDoc}
        tool={tool}
        color={color}
        brushSize={brushSize}
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
        onShapeClick={(s) => setEditingShape(s)}
        showTokenLabels={showTokenLabels}
        showHealthBars={showHealthBars}
        showGhostTrails={showGhostTrails}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
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
      />

      <ToolDock
        tool={tool}
        setTool={setToolAndReopen}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.current.length > 0}
        canRedo={redoStack.current.length > 0}
      />

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

      {combatOpen && (
        <CombatTrackerPanel onClose={() => setCombatOpen(false)} />
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
