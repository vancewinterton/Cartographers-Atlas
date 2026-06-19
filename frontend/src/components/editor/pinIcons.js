import {
  MapPin,
  Beer,
  Castle,
  Skull,
  Trees,
  Mountain,
  Home,
  Square,
  Crown,
  Star,
  Gem,
  Tent,
  Anchor,
  Flame,
  Swords,
  ScrollText,
  Eye,
} from "lucide-react";

// Each entry: id, label, Icon component
export const PIN_ICONS = [
  { id: "pin", label: "Pin", Icon: MapPin },
  { id: "tavern", label: "Tavern", Icon: Beer },
  { id: "castle", label: "Castle", Icon: Castle },
  { id: "town", label: "Town", Icon: Home },
  { id: "dungeon", label: "Dungeon", Icon: Square },
  { id: "tomb", label: "Tomb", Icon: Crown },
  { id: "skull", label: "Danger", Icon: Skull },
  { id: "forest", label: "Forest", Icon: Trees },
  { id: "mountain", label: "Mountain", Icon: Mountain },
  { id: "magic", label: "Magic", Icon: Star },
  { id: "treasure", label: "Treasure", Icon: Gem },
  { id: "camp", label: "Camp", Icon: Tent },
  { id: "port", label: "Port", Icon: Anchor },
  { id: "battle", label: "Battle", Icon: Swords },
  { id: "ruins", label: "Ruins", Icon: ScrollText },
  { id: "lair", label: "Lair", Icon: Flame },
  { id: "watch", label: "Watch", Icon: Eye },
];

export const ICON_MAP = Object.fromEntries(PIN_ICONS.map((p) => [p.id, p.Icon]));

export function getPinIcon(id) {
  return ICON_MAP[id] || MapPin;
}
