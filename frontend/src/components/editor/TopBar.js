import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Home,
  Save,
  Upload,
  Map as MapIcon,
  ChevronDown,
  Download,
} from "lucide-react";
import { useRef } from "react";

export default function TopBar({
  campaign,
  mapDoc,
  allMaps,
  onHome,
  onSave,
  onImport,
  onSwitchMap,
  onExport,
}) {
  const fileRef = useRef(null);

  return (
    <div
      data-testid="editor-topbar"
      className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none"
    >
      <div className="glass rounded-2xl px-4 py-2 flex items-center gap-3 pointer-events-auto">
        <button
          data-testid="topbar-home-btn"
          onClick={onHome}
          className="text-stone-400 hover:text-amber-500 transition p-1.5 rounded-lg hover:bg-white/5"
          aria-label="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex flex-col leading-tight">
          <span className="font-mono-cart text-[10px] uppercase tracking-widest text-stone-500">
            {campaign.name}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="map-switcher"
                className="font-display text-lg text-stone-100 flex items-center gap-1 hover:text-amber-500 transition"
              >
                {mapDoc.name}
                <ChevronDown className="w-4 h-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1E1B18] border-white/10 min-w-[240px]">
              <DropdownMenuLabel className="text-stone-500 text-xs uppercase tracking-wider">
                Maps in this campaign
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              {allMaps.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  data-testid={`switch-map-${m.id}`}
                  onClick={() => onSwitchMap(m.id)}
                  className="cursor-pointer focus:bg-white/5 focus:text-amber-500"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-2 opacity-60" />
                  <span className="flex-1">{m.name}</span>
                  {m.parent_map_id && (
                    <span className="font-mono-cart text-[9px] text-stone-500 uppercase tracking-wider">
                      sub
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="glass rounded-2xl px-2 py-2 flex items-center gap-1 pointer-events-auto">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
          data-testid="import-image-input"
        />
        <Button
          data-testid="import-map-btn"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          className="text-stone-300 hover:bg-white/5 hover:text-amber-500 h-9"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Image
        </Button>
        <Button
          data-testid="export-png-btn"
          variant="ghost"
          onClick={onExport}
          className="text-stone-300 hover:bg-white/5 hover:text-amber-500 h-9"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PNG
        </Button>
        <div className="h-5 w-px bg-white/10 mx-1" />
        <Button
          data-testid="save-map-btn"
          onClick={onSave}
          className="bg-amber-600 hover:bg-amber-500 text-stone-950 h-9"
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
