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
    pushHistory();
    setPins((ps) => ps.filter((p) => p.id !== pinId));
    setNestedSheetOpen(false);
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
      />

      <ToolDock
        tool={tool}
        setTool={setTool}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.current.length > 0}
        canRedo={redoStack.current.length > 0}
      />

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
      />

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
    </div>
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
