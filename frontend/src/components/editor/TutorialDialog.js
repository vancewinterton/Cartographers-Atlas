import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  BookOpen,
  Hand,
  Paintbrush,
  MapPin,
  Swords,
  Grid3x3,
  ImagePlus,
  Sparkles,
  Eraser,
  Share2,
  Keyboard,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const SECTIONS = [
  {
    id: "welcome",
    icon: BookOpen,
    title: "Welcome, Cartographer",
    body: (
      <>
        <p>
          <strong className="text-amber-500">Cartographer&apos;s Atlas</strong> is a
          living D&amp;D map editor. Create campaigns, import any map you like, draw on it,
          drop tokens for combat, and link sub-maps to pins so a whole world of detail is
          always one click away.
        </p>
        <p className="mt-3 text-stone-400">
          This tutorial covers the basics. You can re-open it any time from the dashboard.
        </p>
      </>
    ),
  },
  {
    id: "navigation",
    icon: Hand,
    title: "Move around the map",
    body: (
      <ul className="space-y-2 list-disc list-inside marker:text-amber-500">
        <li>
          Pick the <strong>Hand</strong> tool to pan and zoom freely.
        </li>
        <li>
          From any other tool, <strong>hold middle-mouse</strong> to pan without switching.
        </li>
        <li>
          Use the <strong>zoom slider</strong> at the bottom for precise zoom levels, or scroll
          to step in/out smoothly.
        </li>
        <li>Click the % indicator to snap back to 100%.</li>
      </ul>
    ),
  },
  {
    id: "drawing",
    icon: Paintbrush,
    title: "Draw on the map",
    body: (
      <ul className="space-y-2 list-disc list-inside marker:text-amber-500">
        <li>
          <strong>Brush</strong> — freehand strokes. Set color and size in the right panel.
        </li>
        <li>
          <strong>Rect / Circle / Polygon / Text</strong> — drag to shape, click to label.
        </li>
        <li>
          <strong>Layers</strong> let you group drawings and toggle them on/off without
          losing anything.
        </li>
      </ul>
    ),
  },
  {
    id: "pins",
    icon: MapPin,
    title: "Pins & nested maps",
    body: (
      <>
        <p>
          A <strong>pin</strong> marks a location and can hold notes, an image, and a{" "}
          <strong>linked sub-map</strong>.
        </p>
        <ol className="mt-3 space-y-2 list-decimal list-inside marker:text-amber-500">
          <li>Pick the Pin tool, click anywhere to drop one.</li>
          <li>Switch back to the Hand tool, then click the pin to edit it.</li>
          <li>
            Pick an <strong>icon</strong> (Castle, Tavern, Dungeon, Skull…) and a color.
          </li>
          <li>
            Type a name in <em>&ldquo;Linked Sub-Map&rdquo;</em> and hit Create — the pin now
            opens a fresh map when clicked. Great for dungeons inside cities.
          </li>
          <li>Drag pins to move them. Click the trash icon to remove.</li>
        </ol>
      </>
    ),
  },
  {
    id: "combat",
    icon: Swords,
    title: "Tokens, Grid & Assets",
    body: (
      <ul className="space-y-2 list-disc list-inside marker:text-amber-500">
        <li>
          <strong>Token</strong> tool — drops a colored circle for an enemy / NPC. Stroke size
          sets the diameter (set it to 1 for tiny minions). Click any token to edit
          name, HP, color, size.
        </li>
        <li>
          <strong>Grid</strong> tool — drag to place a battle grid. Cell size = stroke size × 8.
          Click the grid to live-adjust width, height, cell size.
        </li>
        <li>
          <strong>Import Asset</strong> — click the map, pick a character portrait or token
          art. Drag to move, click to scale or <strong>crop</strong> it.
        </li>
      </ul>
    ),
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI redraw a region",
    body: (
      <>
        <p>
          Select the <strong>AI Redraw</strong> tool and drag a rectangle over an area.
          Describe what should appear there (&ldquo;medieval port city with stone harbor&rdquo;) and
          pick a model: <strong>Nano Banana</strong> edits the cropped region; <strong>GPT
          Image 1</strong> generates fresh art from the description.
        </p>
        <p className="mt-3 text-stone-400">
          Toggle <em>Blend edges</em> so the result fades softly into the surrounding terrain.
        </p>
      </>
    ),
  },
  {
    id: "erase",
    icon: Eraser,
    title: "Two erasers",
    body: (
      <ul className="space-y-2 list-disc list-inside marker:text-amber-500">
        <li>
          <strong>Soft Eraser</strong> — drag over brush strokes to surgically remove portions
          (only affects brush strokes).
        </li>
        <li>
          <strong>Delete Shape</strong> — click or drag through any shape, pin, token, asset
          or grid to delete it entirely.
        </li>
      </ul>
    ),
  },
  {
    id: "share",
    icon: Share2,
    title: "Share with your players",
    body: (
      <p>
        Hit <strong>Share</strong> in the top bar to create a read-only link. Your
        party can open it in any browser to pan/zoom, click pins, view notes & images, and
        navigate sub-maps — but they can&apos;t edit anything.
      </p>
    ),
  },
  {
    id: "shortcuts",
    icon: Keyboard,
    title: "Keyboard shortcuts",
    body: (
      <div className="grid grid-cols-2 gap-2 font-mono-cart text-xs">
        <Kbd>Ctrl + Z</Kbd>
        <span>Undo</span>
        <Kbd>Ctrl + Shift + Z</Kbd>
        <span>Redo</span>
        <Kbd>Ctrl + Y</Kbd>
        <span>Redo (alt)</span>
        <Kbd>Esc</Kbd>
        <span>Cancel polygon / close dialog</span>
        <Kbd>Enter</Kbd>
        <span>Finish polygon</span>
        <Kbd>Middle-click drag</Kbd>
        <span>Pan with any tool</span>
      </div>
    ),
  },
];

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded-md border border-white/10 bg-black/40 px-2 py-1 text-stone-200">
      {children}
    </kbd>
  );
}

export default function TutorialDialog({ trigger }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const section = SECTIONS[i];
  const Icon = section.icon;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            data-testid="tutorial-btn"
            variant="ghost"
            className="text-stone-300 hover:bg-white/5 hover:text-amber-500"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            How to use
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        data-testid="tutorial-dialog"
        className="bg-[#1E1B18] border-white/10 max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-3xl flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-amber-600/15 ring-1 ring-amber-700/30 flex items-center justify-center">
              <Icon className="w-5 h-5 text-amber-500" />
            </span>
            {section.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Tutorial: {section.title}
          </DialogDescription>
        </DialogHeader>
        <div className="text-stone-200 text-sm leading-relaxed min-h-[200px]">
          {section.body}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            {SECTIONS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-amber-500" : "w-1.5 bg-white/15 hover:bg-white/30"
                }`}
                aria-label={`Go to ${s.title}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setI((v) => Math.max(0, v - 1))}
              disabled={i === 0}
              className="text-stone-400 hover:bg-white/5"
              data-testid="tutorial-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {i === SECTIONS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setOpen(false)}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950"
                data-testid="tutorial-finish"
              >
                Got it
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setI((v) => Math.min(SECTIONS.length - 1, v + 1))}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950"
                data-testid="tutorial-next"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Unused but kept to silence lint if someone imports the icons list
export const TUTORIAL_ICONS = { Grid3x3, ImagePlus, Trash2 };
