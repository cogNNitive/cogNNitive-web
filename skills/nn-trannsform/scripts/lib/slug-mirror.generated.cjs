/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-core/src/slugPrimitives.ts (-> src/sourceRef.ts)
 * Regenerate: node scripts/build-trannsform-slug-mirror.mjs
 * Drift-guarded by scripts/verify.js (build-trannsform-slug-mirror --check).
 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// iNNfo/packages/innfo-core/src/slugPrimitives.ts
var slugPrimitives_exports = {};
__export(slugPrimitives_exports, {
  headingSlugParts: () => headingSlugParts,
  normalizeName: () => normalizeName,
  slugifyHeading: () => slugifyHeading,
  slugifyUnitHeading: () => slugifyUnitHeading
});
module.exports = __toCommonJS(slugPrimitives_exports);

// iNNfo/packages/innfo-core/src/parser/slug.ts
function nfc(text) {
  return text.normalize("NFC");
}
function stripCombiningMarks(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// iNNfo/packages/innfo-core/src/sourceRef.ts
function slugifyHeading(text) {
  const stripped = nfc(text).replace(/^\s*#{1,6}\s*/, "").replace(/[*_`]/g, "");
  return stripped.split(/(?<=[\p{L}\p{N}])--(?=[\p{L}\p{N}])/gu).map(slugifyFlat).join("--");
}
function slugifyFlat(part) {
  const transliterated = stripCombiningMarks(part);
  const dashed = transliterated.trim().toLowerCase().replace(/\s+/g, "-");
  const filtered = dashed.replace(/[^\p{L}\p{N}-]+/gu, "");
  return filtered.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function headingSlugParts(text) {
  const clean = text.trim();
  const boundary = clean.indexOf(":");
  if (boundary > 0) {
    const concept = clean.slice(0, boundary).trim();
    const element = clean.slice(boundary + 1).trim();
    if (concept && element) {
      return {
        slug: `${slugifyHeading(concept)}--${slugifyHeading(element)}`,
        concept,
        element
      };
    }
  }
  return { slug: slugifyHeading(clean) };
}
function slugifyUnitHeading(level, text) {
  const clean = text.trim();
  const { slug } = headingSlugParts(clean);
  const clamped = Math.min(6, Math.max(1, Math.floor(level) || 1));
  return { level: clamped, text: clean, slug };
}
function normalizeName(name) {
  return nfc(name).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-\p{L}\p{N}]+/gu, "");
}
