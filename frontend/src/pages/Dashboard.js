import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Campaigns, Presets } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Compass, Plus, Trash2, MapPinned, Sparkles, BookOpen, Upload, Wand2 } from "lucide-react";
import TutorialDialog from "../components/editor/TutorialDialog";
import AdSlot from "../components/AdSlot";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [presets, setPresets] = useState([]);
  const [usingPreset, setUsingPreset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setCampaigns(await Campaigns.list());
    } catch (e) {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      setPresets(await Presets.list());
    } catch (e) {
      /* presets are optional — ignore load errors */
    }
  };

  useEffect(() => {
    load();
    loadPresets();
  }, []);

  const handleUsePreset = async (preset) => {
    setUsingPreset(preset.id);
    try {
      const created = await Presets.use(preset.id);
      toast.success(`Created "${created.name}" from template`);
      navigate(`/campaign/${created.id}`);
    } catch (e) {
      toast.error("Could not use this template");
    } finally {
      setUsingPreset(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Campaign needs a name");
      return;
    }
    let cover = null;
    if (coverFile) {
      cover = await fileToDataURL(coverFile);
    }
    try {
      const c = await Campaigns.create({
        name: name.trim(),
        description: desc.trim(),
        cover_image: cover,
      });
      setOpen(false);
      setName("");
      setDesc("");
      setCoverFile(null);
      toast.success("Campaign forged");
      navigate(`/campaign/${c.id}`);
    } catch (e) {
      toast.error("Failed to create campaign");
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this campaign and all its maps?")) return;
    await Campaigns.remove(id);
    toast.success("Campaign archived");
    load();
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.campaign || !Array.isArray(parsed?.maps)) {
        throw new Error("Not a valid campaign export");
      }
      const created = await Campaigns.import(parsed, null);
      toast.success(`Imported "${created.name}"`);
      await load();
      navigate(`/campaign/${created.id}`);
    } catch (e) {
      toast.error(
        e?.response?.data?.detail || e?.message || "Import failed — invalid file?"
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen grain relative" data-testid="dashboard-page">
      {/* Hero */}
      <div className="relative px-8 lg:px-20 pt-16 pb-12 border-b border-white/5">
        <div className="flex items-center gap-3 text-amber-500 mb-6">
          <Compass className="w-5 h-5" strokeWidth={1.5} />
          <span className="font-mono-cart text-xs tracking-[0.3em] uppercase">
            Cartographer&apos;s Atlas
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none text-[#F3F2F0]">
              Forge worlds.
              <span className="block text-amber-600 italic">Chart legends.</span>
            </h1>
            <p className="text-stone-400 mt-6 text-base max-w-xl leading-relaxed">
              A living atlas for your D&amp;D campaigns. Import any map, draw,
              pin, nest sub-maps, and conjure new regions with AI.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-3">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
                data-testid="import-campaign-input"
              />
              <Button
                data-testid="import-campaign-btn"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                variant="ghost"
                className="text-stone-300 hover:bg-white/5 hover:text-amber-500 px-5 py-6 rounded-full border border-white/10"
                title="Import a campaign exported from another atlas"
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? "Importing…" : "Import"}
              </Button>
              <TutorialDialog />
              <DialogTrigger asChild>
                <Button
                  data-testid="new-campaign-btn"
                  className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium px-6 py-6 rounded-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent className="bg-[#1E1B18] border-white/10">
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">
                  New Campaign
                </DialogTitle>
                <DialogDescription className="text-stone-500 text-sm">
                  Begin a new world. You can import a base map later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-400">
                    Campaign Name
                  </label>
                  <Input
                    data-testid="new-campaign-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Sundered Realms"
                    className="bg-black/40 border-white/10 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-400">
                    Description
                  </label>
                  <Textarea
                    data-testid="new-campaign-desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="A brief synopsis…"
                    className="bg-black/40 border-white/10 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-400">
                    World Map Image (optional)
                  </label>
                  <Input
                    data-testid="new-campaign-cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="bg-black/40 border-white/10 mt-1 file:text-amber-500 file:bg-transparent file:border-0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  data-testid="create-campaign-confirm"
                  onClick={handleCreate}
                  className="bg-amber-600 hover:bg-amber-500 text-stone-950"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Forge it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates gallery */}
      {presets.length > 0 && (
        <div className="px-8 lg:px-20 pt-10" data-testid="templates-section">
          <div className="flex items-baseline justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Wand2 className="w-5 h-5 text-amber-500" strokeWidth={1.6} />
              <h2 className="font-display text-3xl text-stone-200">
                Starter Templates
              </h2>
            </div>
            <span className="font-mono-cart text-xs text-stone-500">
              {presets.length} ready-to-run
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {presets.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                busy={usingPreset === p.id}
                onUse={() => handleUsePreset(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="px-8 lg:px-20 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-display text-3xl text-stone-200">
            Your Campaigns
          </h2>
          <span className="font-mono-cart text-xs text-stone-500">
            {campaigns.length} world{campaigns.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="text-stone-500 font-mono-cart text-sm">
            Loading atlas…
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState onCreate={() => setOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onOpen={() => navigate(`/campaign/${c.id}`)}
                onDelete={(e) => handleDelete(c.id, e)}
              />
            ))}
          </div>
        )}

        {/* Bottom banner ad — skinny, easy to ignore */}
        <div className="mt-12 max-w-5xl mx-auto">
          <AdSlot orientation="horizontal" testId="dashboard-ad-bottom" />
        </div>
      </div>

      {/* Side rail ads — only on very wide screens so they never crowd content */}
      <AdSlot
        orientation="vertical"
        testId="dashboard-ad-left"
        className="hidden 2xl:flex fixed left-4 top-1/2 -translate-y-1/2 z-10"
      />
      <AdSlot
        orientation="vertical"
        testId="dashboard-ad-right"
        className="hidden 2xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-10"
      />
    </div>
  );
}

function PresetCard({ preset, onUse, busy }) {
  return (
    <div
      data-testid={`preset-card-${preset.id}`}
      className="group relative rounded-2xl overflow-hidden border border-amber-700/30 bg-gradient-to-br from-[#221d16] to-[#1A1714] hover:border-amber-600/60 transition-all hover:-translate-y-1 duration-300 flex flex-col"
    >
      <div className="aspect-[16/9] relative overflow-hidden">
        {preset.cover_image ? (
          <img
            src={preset.cover_image}
            alt=""
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900/30 via-stone-900 to-black flex items-center justify-center">
            <Wand2 className="w-14 h-14 text-amber-600/40" strokeWidth={1} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A09] via-[#0B0A09]/30 to-transparent" />
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400 font-mono-cart text-[9px] uppercase tracking-widest border border-amber-700/40">
          Template
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-2xl text-stone-100 leading-tight">
          {preset.name}
        </h3>
        {preset.description ? (
          <p className="text-stone-400 text-sm mt-2 line-clamp-2 leading-relaxed flex-1">
            {preset.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <Button
          data-testid={`use-preset-${preset.id}`}
          onClick={onUse}
          disabled={busy}
          className="mt-4 w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium"
        >
          {busy ? (
            "Creating…"
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Use this campaign
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onOpen, onDelete }) {
  return (
    <div
      data-testid={`campaign-card-${campaign.id}`}
      onClick={onOpen}
      className="group relative cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-[#1E1B18] hover:border-amber-700/50 transition-all hover:-translate-y-1 duration-300"
    >
      <div className="aspect-[16/10] relative overflow-hidden">
        {campaign.cover_image ? (
          <img
            src={campaign.cover_image}
            alt=""
            className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-800 via-stone-900 to-black flex items-center justify-center">
            <MapPinned className="w-16 h-16 text-amber-700/30" strokeWidth={1} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A09] via-[#0B0A09]/40 to-transparent" />
      </div>
      <div className="p-6">
        <h3 className="font-display text-2xl text-stone-100 leading-tight">
          {campaign.name}
        </h3>
        {campaign.description ? (
          <p className="text-stone-400 text-sm mt-2 line-clamp-2 leading-relaxed">
            {campaign.description}
          </p>
        ) : null}
        <div className="flex items-center justify-between mt-4">
          <span className="font-mono-cart text-[10px] uppercase tracking-widest text-stone-500">
            {new Date(campaign.updated_at).toLocaleDateString()}
          </span>
          <button
            data-testid={`delete-campaign-${campaign.id}`}
            onClick={onDelete}
            className="text-stone-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
            aria-label="Delete campaign"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="border border-dashed border-white/10 rounded-3xl p-16 text-center">
      <Compass className="w-12 h-12 text-amber-600/60 mx-auto mb-4" strokeWidth={1} />
      <h3 className="font-display text-3xl text-stone-200">
        No realms charted yet
      </h3>
      <p className="text-stone-500 mt-2 text-sm">
        Begin a new campaign to start drawing your world.
      </p>
      <Button
        data-testid="empty-create-campaign"
        onClick={onCreate}
        className="mt-6 bg-amber-600 hover:bg-amber-500 text-stone-950"
      >
        <Plus className="w-4 h-4 mr-2" />
        New Campaign
      </Button>
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
