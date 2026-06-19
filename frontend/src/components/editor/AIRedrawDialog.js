import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "../ui/radio-group";
import { Label } from "../ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { AI } from "../../lib/api";
import { toast } from "sonner";

export default function AIRedrawDialog({ region, mapDoc, onClose, onComplete }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gemini");
  const [loading, setLoading] = useState(false);
  const [cropPreview, setCropPreview] = useState(null);
  const cropRef = useRef(null);

  // Crop the region from the base map image to send as input to Gemini.
  useEffect(() => {
    let cancelled = false;
    if (!mapDoc.image_data) {
      setCropPreview(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const sx = (region.x / mapDoc.image_width) * img.naturalWidth;
      const sy = (region.y / mapDoc.image_height) * img.naturalHeight;
      const sw = (region.w / mapDoc.image_width) * img.naturalWidth;
      const sh = (region.h / mapDoc.image_height) * img.naturalHeight;
      const c = document.createElement("canvas");
      const size = 1024;
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#1a1714";
      ctx.fillRect(0, 0, size, size);
      try {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        const url = c.toDataURL("image/png");
        cropRef.current = url;
        setCropPreview(url);
      } catch (e) {
        cropRef.current = null;
        setCropPreview(null);
      }
    };
    img.src = mapDoc.image_data;
    return () => {
      cancelled = true;
    };
  }, [region, mapDoc]);

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe what you want drawn");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        prompt: prompt.trim(),
        model,
        width: 1024,
        height: 1024,
      };
      if (model === "gemini" && cropRef.current) {
        payload.image_base64 = cropRef.current;
      }
      const res = await AI.redraw(payload);
      const url = `data:image/png;base64,${res.image_base64}`;
      onComplete(url);
    } catch (e) {
      console.error(e);
      toast.error(
        e?.response?.data?.detail?.toString().slice(0, 150) || "AI generation failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="ai-redraw-dialog"
        className="bg-[#1E1B18] border-white/10 max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-3xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            AI Redraw Region
          </DialogTitle>
          <DialogDescription className="text-stone-500 text-sm">
            Describe what should appear in the selected area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {cropPreview && (
            <div className="rounded-xl overflow-hidden border border-white/10">
              <img
                src={cropPreview}
                alt="region preview"
                className="w-full h-40 object-cover"
              />
              <div className="bg-black/40 px-3 py-1.5 font-mono-cart text-[10px] uppercase tracking-wider text-stone-400">
                Selected region · {Math.round(region.w)} × {Math.round(region.h)} px
              </div>
            </div>
          )}

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Describe what should appear here
            </Label>
            <Textarea
              data-testid="ai-prompt-input"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A bustling medieval port city with stone walls, a harbor, and ships…"
              className="mt-2 bg-black/40 border-white/10 min-h-[100px]"
            />
          </div>

          <div>
            <Label className="font-mono-cart text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2 block">
              Model
            </Label>
            <RadioGroup value={model} onValueChange={setModel} className="grid grid-cols-2 gap-2">
              <label
                data-testid="model-gemini"
                className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                  model === "gemini"
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="gemini" id="m-gemini" />
                  <div>
                    <div className="text-sm font-medium text-stone-100">Nano Banana</div>
                    <div className="text-[10px] text-stone-500 font-mono-cart uppercase tracking-wider">
                      Edits using selected region
                    </div>
                  </div>
                </div>
              </label>
              <label
                data-testid="model-openai"
                className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                  model === "openai"
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="openai" id="m-openai" />
                  <div>
                    <div className="text-sm font-medium text-stone-100">GPT Image 1</div>
                    <div className="text-[10px] text-stone-500 font-mono-cart uppercase tracking-wider">
                      Generates from prompt only
                    </div>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            data-testid="ai-cancel-btn"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-stone-400 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            data-testid="ai-generate-btn"
            onClick={generate}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-stone-950"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Conjuring… (~30s)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
