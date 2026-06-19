import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Share as ShareAPI } from "../lib/api";
import MapCanvas from "../components/editor/MapCanvas";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Compass, MapPinned, ArrowUpRight, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";

export default function SharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [pinSheetPin, setPinSheetPin] = useState(null);

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

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-4">
        <Compass className="w-12 h-12 text-amber-600/60 mb-4" />
        <h1 className="font-display text-4xl text-stone-200">Map not found</h1>
        <p className="text-stone-500 mt-2 text-sm">{error}</p>
      </div>
    );
  }
  if (!data || !currentMapId) {
    return (
      <div className="h-screen flex items-center justify-center text-stone-500 font-mono-cart">
        Loading shared atlas…
      </div>
    );
  }

  const currentMap = data.maps.find((m) => m.id === currentMapId);
  const allShapes = (currentMap.layers || []).flatMap((l) => l.shapes || []);
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
        tool="pan"
        color="#D97706"
        brushSize={4}
        shapes={allShapes}
        setShapes={() => {}}
        pins={currentMap.pins || []}
        setPins={() => {}}
        layers={layers}
        activeLayerId={layers[0].id}
        onPushHistory={() => {}}
        onPinClick={(p) => setPinSheetPin(p)}
        onAIRegionSelected={() => {}}
        pinColorFilter={new Set()}
        readOnly
      />

      {/* Floating share header */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div className="glass rounded-2xl px-4 py-2 flex items-center gap-3 pointer-events-auto">
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
            Read only
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
