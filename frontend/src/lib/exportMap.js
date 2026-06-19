// Export composed map (base image + drawing shapes + pins) as a PNG download.
// Renders an SVG of all shapes/pins, then composites onto a canvas with the base image.

import { PIN_ICONS } from "../components/editor/pinIcons";

export async function exportMapAsPng(mapDoc, shapes, pins, layers, campaignName) {
  const W = mapDoc.image_width || 1600;
  const H = mapDoc.image_height || 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1714";
  ctx.fillRect(0, 0, W, H);

  // Base image
  if (mapDoc.image_data) {
    const img = await loadImage(mapDoc.image_data);
    ctx.drawImage(img, 0, 0, W, H);
  }

  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));

  // Image shapes (AI generated images) first to keep them under drawings
  const imageShapes = shapes.filter(
    (s) => s.type === "image" && visibleLayerIds.has(s.layerId),
  );
  for (const s of imageShapes) {
    const im = await loadImage(s.src);
    ctx.drawImage(im, s.x, s.y, s.w, s.h);
  }

  // Vector shapes via SVG (single batch for performance)
  const visibleVector = shapes.filter(
    (s) => s.type !== "image" && visibleLayerIds.has(s.layerId),
  );
  if (visibleVector.length) {
    const svgString = buildSvg(visibleVector, W, H);
    const svgImg = await loadImage(
      "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString))),
    );
    ctx.drawImage(svgImg, 0, 0, W, H);
  }

  // Pins (rasterized so colors + icons render)
  for (const p of pins) {
    drawPin(ctx, p);
  }

  // Download
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  const safeName = (campaignName || "map")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-");
  a.download = `${safeName}-${mapDoc.name.replace(/\s+/g, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function buildSvg(shapes, W, H) {
  const els = shapes.map(shapeToSvg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${els}</svg>`;
}

function shapeToSvg(s) {
  const c = escapeAttr(s.color || "#D97706");
  const sw = s.size || 4;
  if (s.type === "brush") {
    return `<polyline points="${pointPairs(s.points)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (s.type === "rect") {
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
  }
  if (s.type === "circle") {
    return `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${Math.abs(s.w) / 2}" ry="${Math.abs(s.h) / 2}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
  }
  if (s.type === "polygon") {
    return `<polygon points="${pointPairs(s.points)}" fill="${c}33" stroke="${c}" stroke-width="${sw}"/>`;
  }
  if (s.type === "text") {
    return `<text x="${s.x}" y="${s.y}" fill="${c}" font-size="${s.size}" font-family="Cormorant Garamond, serif" font-weight="600">${escapeText(s.text || "")}</text>`;
  }
  return "";
}

function pointPairs(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push(`${pts[i]},${pts[i + 1]}`);
  return out.join(" ");
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]),
  );
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function drawPin(ctx, p) {
  const r = 18;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Tail
  ctx.fillStyle = p.color || "#D97706";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.4, -r * 0.6);
  ctx.lineTo(r * 0.4, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(0, -r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();
  // Letter for icon
  const iconLabel = (PIN_ICONS.find((pi) => pi.id === (p.icon || "pin")) || PIN_ICONS[0])
    .label[0]
    .toUpperCase();
  ctx.fillStyle = "#0B0A09";
  ctx.font = "bold 18px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(iconLabel, 0, -r);
  // Label above
  if (p.label) {
    ctx.font = "600 14px Outfit, sans-serif";
    ctx.textBaseline = "bottom";
    const text = p.label + (p.linked_map_id ? " ↗" : "");
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = "rgba(20,18,16,0.85)";
    ctx.fillRect(-w / 2, -r * 2 - 22, w, 22);
    ctx.fillStyle = "#F3F2F0";
    ctx.fillText(text, 0, -r * 2 - 5);
  }
  ctx.restore();
}
