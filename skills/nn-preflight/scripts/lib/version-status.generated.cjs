/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-core/src/workspace/integrity/versionStatus.ts
 * Regenerate: node scripts/build-preflight-primitives.mjs
 * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).
 */
// @ts-nocheck
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

// iNNfo/packages/innfo-core/src/workspace/integrity/versionStatus.ts
var versionStatus_exports = {};
__export(versionStatus_exports, {
  classifyAgainstCatalog: () => classifyAgainstCatalog,
  compareVersions: () => compareVersions,
  gapKind: () => gapKind,
  parsePinnedUrl: () => parsePinnedUrl,
  parseSemVer: () => parseSemVer,
  parseUnversionedBlueprintName: () => parseUnversionedBlueprintName
});
module.exports = __toCommonJS(versionStatus_exports);
var VERSION_RE = /V_(\d+)-(\d+)-(\d+)/i;
function parseSemVer(v) {
  const m = String(v).match(VERSION_RE);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
function gapKind(pinned, adopted) {
  const a = parseSemVer(pinned);
  const b = parseSemVer(adopted);
  if (!a || !b) return null;
  if (a.major === b.major && a.minor === b.minor && a.patch === b.patch) return "same";
  if (a.major !== b.major) return "major";
  if (a.minor !== b.minor) return "minor";
  return "patch";
}
function compareVersions(a, b) {
  const va = parseSemVer(a);
  const vb = parseSemVer(b);
  if (!va || !vb) return 0;
  return va.major - vb.major || va.minor - vb.minor || va.patch - vb.patch;
}
function parsePinnedUrl(url) {
  const basename = String(url).split("/").pop()?.replace(/\.md$/i, "") ?? "";
  const flat = basename.match(/^(.+?)_V_(\d+)-(\d+)-(\d+)(?:_spec)?_NN$/i);
  if (flat) return { name: flat[1], version: `V_${flat[2]}-${flat[3]}-${flat[4]}` };
  const pkg = String(url).match(/bluepriNNts\/([^/]+)\/V_(\d+)-(\d+)-(\d+)\/spec_NN\.md/i);
  if (pkg) return { name: pkg[1], version: `V_${pkg[2]}-${pkg[3]}-${pkg[4]}` };
  return null;
}
function parseUnversionedBlueprintName(url) {
  const str = String(url);
  const pkg = str.match(/bluepriNNts\/([^/]+)\/(?:spec_NN|[a-zA-Z0-9_-]+_spec_NN)\.md$/i);
  if (pkg) return pkg[1];
  const flat = str.match(/bluepriNNts\/([^/]+?)_spec_NN\.md$/i);
  if (flat) return flat[1];
  return null;
}
function classifyAgainstCatalog(parentUrl, catalog) {
  const pinned = parentUrl ? parsePinnedUrl(parentUrl) : null;
  if (catalog === null) {
    const unversionedName = parentUrl ? parseUnversionedBlueprintName(parentUrl) : null;
    return {
      status: "unknown",
      template: pinned?.name ?? unversionedName ?? null,
      pinned: pinned?.version ?? null,
      adopted: null,
      gap: "none",
      detail: "Catalog unavailable (offline)"
    };
  }
  if (!parentUrl) {
    return {
      status: "unpinned",
      template: null,
      pinned: null,
      adopted: null,
      gap: "none",
      detail: "No parent_spec.url"
    };
  }
  if (!pinned) {
    const unversionedName = parseUnversionedBlueprintName(parentUrl);
    if (unversionedName) {
      const matchKey = Object.keys(catalog.blueprints || {}).find(
        (k) => k.toLowerCase() === unversionedName.toLowerCase()
      );
      const entry2 = matchKey ? catalog.blueprints[matchKey] : catalog.frozen?.[unversionedName];
      if (entry2) {
        return {
          status: "current",
          template: entry2.name,
          pinned: entry2.adopted,
          adopted: entry2.adopted,
          gap: "same",
          detail: "Canonical unversioned blueprint URL resolved to catalog adopted version"
        };
      }
      return {
        status: "unlisted",
        template: unversionedName,
        pinned: null,
        adopted: null,
        gap: "none",
        detail: "Template not in catalog"
      };
    }
    const allCatalogEntries = [
      ...Object.values(catalog.blueprints || {}),
      ...Object.values(catalog.frozen || {})
    ];
    for (const entry2 of allCatalogEntries) {
      if (entry2.versions?.some((v) => v.url === parentUrl)) {
        return {
          status: "current",
          template: entry2.name,
          pinned: entry2.adopted,
          adopted: entry2.adopted,
          gap: "same",
          detail: "Canonical unversioned blueprint URL resolved to catalog adopted version"
        };
      }
    }
    return {
      status: "unlisted",
      template: null,
      pinned: null,
      adopted: null,
      gap: "none",
      detail: "Not a versioned canonical template URL"
    };
  }
  let entry = catalog.blueprints?.[pinned.name];
  if (!entry && catalog.frozen?.[pinned.name]) {
    entry = catalog.frozen[pinned.name];
  }
  if (!entry) {
    return {
      status: "unlisted",
      template: pinned.name,
      pinned: pinned.version,
      adopted: null,
      gap: "none",
      detail: "Template not in catalog"
    };
  }
  const known = entry.versions.some((v) => v.blueprint_version === pinned.version);
  if (!known && compareVersions(pinned.version, entry.adopted) > 0) {
    return {
      status: "ahead",
      template: pinned.name,
      pinned: pinned.version,
      adopted: entry.adopted,
      gap: "none",
      detail: "Model is ahead of the catalog adopted version"
    };
  }
  if (!known) {
    return {
      status: "unlisted",
      template: pinned.name,
      pinned: pinned.version,
      adopted: entry.adopted,
      gap: "none",
      detail: "Version not in catalog"
    };
  }
  const kind = gapKind(pinned.version, entry.adopted);
  const cmp = compareVersions(pinned.version, entry.adopted);
  let status;
  if (kind === "same") status = "current";
  else if (cmp < 0) status = "upgrade-available";
  else if (cmp > 0) status = "ahead";
  else status = "unlisted";
  return {
    status,
    template: pinned.name,
    pinned: pinned.version,
    adopted: entry.adopted,
    gap: status === "upgrade-available" ? kind : status === "current" ? "same" : "none",
    detail: status === "ahead" ? "Model is ahead of the catalog adopted version" : void 0
  };
}
