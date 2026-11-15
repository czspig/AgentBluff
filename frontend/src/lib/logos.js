// Brand logos for each persona, keyed by persona id (src/assets/logos/<id>.svg).
// Source: @lobehub/icons-static-svg 1.98.0 (MIT), copied in so the build needs no extra dependency.

const files = import.meta.glob("../assets/logos/*.svg", { eager: true, query: "?url", import: "default" });

const LOGOS = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.match(/([^/]+)\.svg$/)[1], url]),
);

export function logoFor(id) {
  return LOGOS[id] ?? null;
}
