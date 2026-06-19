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
  Share2,
  Copy,
  Check,
  Swords,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  Dialog as ShareDialog,
  DialogContent as ShareDialogContent,
  DialogDescription as ShareDialogDescription,
  DialogHeader as ShareDialogHeader,
  DialogTitle as ShareDialogTitle,
} from "../ui/dialog";
import { Switch } from "../ui/switch";
import { Campaigns } from "../../lib/api";
import { toast } from "sonner";

export default function TopBar({
  campaign,
  mapDoc,
  allMaps,
  onHome,
  onSave,
  onImport,
  onSwitchMap,
  onExport,
  onShareToken,
  onToggleCombat,
  combatOpen,
}) {
  const fileRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState(campaign.share_token || null);
  const [copied, setCopied] = useState(false);
  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : "";

  const toggleShare = async (enabled) => {
    try {
      if (enabled) {
        const res = await Campaigns.enableShare(campaign.id);
        setShareToken(res.share_token);
        onShareToken?.(res.share_token);
        toast.success("Share link created");
      } else {
        await Campaigns.disableShare(campaign.id);
        setShareToken(null);
        onShareToken?.(null);
        toast.success("Sharing disabled");
      }
    } catch (e) {
      toast.error("Could not change share state");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

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
        <Button
          data-testid="combat-btn"
          variant="ghost"
          onClick={onToggleCombat}
          className={`hover:bg-white/5 h-9 ${combatOpen ? "text-amber-500" : "text-stone-300 hover:text-amber-500"}`}
        >
          <Swords className="w-4 h-4 mr-2" />
          Combat
        </Button>
        <Button
          data-testid="share-btn"
          variant="ghost"
          onClick={() => setShareOpen(true)}
          className="text-stone-300 hover:bg-white/5 hover:text-amber-500 h-9"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
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

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen}>
        <ShareDialogContent
          data-testid="share-dialog"
          className="bg-[#1E1B18] border-white/10 pointer-events-auto"
        >
          <ShareDialogHeader>
            <ShareDialogTitle className="font-display text-3xl flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-500" />
              Share with your players
            </ShareDialogTitle>
            <ShareDialogDescription className="text-stone-400">
              A read-only link your party can open in any browser. They can pan, zoom,
              click pins and navigate sub-maps — but they can&apos;t edit anything.
            </ShareDialogDescription>
          </ShareDialogHeader>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-stone-100">
                  Enable share link
                </div>
                <div className="text-[10px] text-stone-500 font-mono-cart uppercase tracking-wider mt-0.5">
                  Anyone with the link can view this campaign
                </div>
              </div>
              <Switch
                checked={!!shareToken}
                onCheckedChange={toggleShare}
                data-testid="share-toggle"
              />
            </label>
            {shareToken && (
              <div
                data-testid="share-link-row"
                className="flex items-center gap-2 rounded-xl bg-black/40 border border-amber-700/30 px-3 py-2"
              >
                <Input
                  readOnly
                  value={shareUrl}
                  data-testid="share-url-input"
                  className="bg-transparent border-0 focus-visible:ring-0 px-0 text-amber-500 font-mono-cart text-xs"
                />
                <Button
                  data-testid="copy-share-link"
                  size="sm"
                  onClick={copyLink}
                  className="bg-amber-600 hover:bg-amber-500 text-stone-950 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </ShareDialogContent>
      </ShareDialog>
    </div>
  );
}
