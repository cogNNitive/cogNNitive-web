/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-core/src/legacy/detect.ts
 * Regenerate: node scripts/build-preflight-primitives.mjs
 * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).
 */
// legacy:nn-rename/detector
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

// iNNfo/packages/innfo-core/src/legacy/detect.ts
var detect_exports = {};
__export(detect_exports, {
  detectLegacy: () => detectLegacy
});
module.exports = __toCommonJS(detect_exports);

// iNNfo/packages/innfo-core/src/legacy/layout/detect.ts
var RETIRED_LAYOUT_FOLDERS = ["export", "sources/original", "sources/nn", "sources/export"];
async function hasContent(r, dir) {
  return (await r.list(dir)).length > 0;
}
async function detectLegacyLayout(r) {
  const signals = [];
  for (const folder of RETIRED_LAYOUT_FOLDERS) {
    if (await hasContent(r, folder)) {
      signals.push({
        type: "legacy-layout",
        path: folder,
        detail: `Retired folder '${folder}/' still holds content (see the nn-upgrade layout migration)`
      });
    }
  }
  return signals;
}

// iNNfo/packages/innfo-core/src/legacy/detect.ts
var LEGACY_KEYS = [
  "model_version",
  "template_version",
  "template_name",
  "models_dir",
  "templates_dir",
  "target_template"
];
var OVERVIEW_ROOT_RE = /_base_[a-z0-9]+\.md$/i;
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? match[1] : "";
}
async function detectLegacy(r) {
  const signals = [];
  let hasCurrentSignal = false;
  const rootEntries = await r.list("");
  const hasDomainnExact = rootEntries.includes("domaiNN_NN.md");
  if (hasDomainnExact) {
    hasCurrentSignal = true;
  }
  for (const entry of rootEntries) {
    if (entry.toLowerCase().startsWith("domainn") && entry.toLowerCase().endsWith(".md") && entry !== "domaiNN_NN.md") {
      signals.push({
        type: "case-mismatch",
        path: entry,
        detail: `Entrypoint '${entry}' does not match canonical casing 'domaiNN_NN.md'`
      });
    }
    if (entry.toLowerCase().startsWith("workspace") && entry.toLowerCase().endsWith(".md")) {
      signals.push({
        type: "legacy-entrypoint",
        path: entry,
        detail: `Legacy entrypoint detected: '${entry}' (expected 'domaiNN_NN.md')`
      });
    } else if (OVERVIEW_ROOT_RE.test(entry) && entry !== "domaiNN_NN.md") {
      signals.push({
        type: "legacy-entrypoint",
        path: entry,
        detail: `Legacy overview-root entrypoint detected: '${entry}' (expected 'domaiNN_NN.md')`
      });
    }
    if (entry === "models") {
      signals.push({
        type: "legacy-folder",
        path: "models",
        detail: `Legacy folder 'models/' detected (expected 'kNNowledge/')`
      });
    } else if (entry === "templates") {
      signals.push({
        type: "legacy-folder",
        path: "templates",
        detail: `Legacy folder 'templates/' detected (expected 'specs/bluepriNNts/')`
      });
    } else if (entry === "kNNowledge") {
      hasCurrentSignal = true;
    } else if (/^k?n*owledge$/i.test(entry) && entry !== "kNNowledge" && entry !== "models") {
      signals.push({
        type: "case-mismatch",
        path: entry,
        detail: `Folder '${entry}' does not match canonical casing 'kNNowledge'`
      });
    } else if (/^bluepri*n*ts$/i.test(entry) && entry !== "bluepriNNts" && entry !== "templates") {
      signals.push({
        type: "case-mismatch",
        path: entry,
        detail: `Folder '${entry}' does not match canonical casing 'bluepriNNts'`
      });
    }
  }
  if (rootEntries.includes("specs")) {
    const specsEntries = await r.list("specs");
    for (const specEntry of specsEntries) {
      if (specEntry === "templates") {
        signals.push({
          type: "legacy-folder",
          path: "specs/templates",
          detail: `Legacy folder 'specs/templates/' detected (expected 'specs/bluepriNNts/')`
        });
      } else if (specEntry === "bluepriNNts") {
        hasCurrentSignal = true;
      } else if (/^bluepri*n*ts$/i.test(specEntry) && specEntry !== "bluepriNNts" && specEntry !== "templates") {
        signals.push({
          type: "case-mismatch",
          path: `specs/${specEntry}`,
          detail: `Folder 'specs/${specEntry}' does not match canonical casing 'specs/bluepriNNts'`
        });
      }
    }
  }
  const filesToScan = [];
  for (const entry of rootEntries) {
    if (entry.toLowerCase().endsWith(".md")) {
      filesToScan.push(entry);
    }
  }
  async function collectFiles(dir, depth = 0) {
    if (depth > 3) return;
    const entries = await r.list(dir);
    for (const entry of entries) {
      const relPath = dir ? `${dir}/${entry}` : entry;
      if (entry.toLowerCase().endsWith(".md")) {
        filesToScan.push(relPath);
      } else if (!entry.includes(".") && depth < 3) {
        await collectFiles(relPath, depth + 1);
      }
    }
  }
  for (const folder of ["models", "kNNowledge", "templates", "specs/templates", "specs/bluepriNNts"]) {
    await collectFiles(folder);
  }
  const scannedPaths = /* @__PURE__ */ new Set();
  for (const filePath of filesToScan) {
    if (scannedPaths.has(filePath)) continue;
    scannedPaths.add(filePath);
    const content = await r.read(filePath);
    if (!content) continue;
    const frontmatter = extractFrontmatter(content);
    if (frontmatter.includes("knowledge_version:")) hasCurrentSignal = true;
    if (/type::\s*knowledge\b/.test(content)) hasCurrentSignal = true;
    if (frontmatter.includes("iNNfo_V_0-3-0")) hasCurrentSignal = true;
    for (const legacyKey of LEGACY_KEYS) {
      const keyPattern = new RegExp(`^\\s*${legacyKey}\\s*:`, "m");
      if (keyPattern.test(frontmatter)) {
        signals.push({
          type: "legacy-key",
          path: filePath,
          detail: `Legacy key '${legacyKey}' found in '${filePath}'`
        });
      }
    }
    if (/type::\s*model\b/i.test(content)) {
      signals.push({
        type: "legacy-keyword",
        path: filePath,
        detail: `Legacy keyword 'type:: model' found in '${filePath}' (expected 'type:: knowledge')`
      });
    }
    if (frontmatter.includes("/specs/templates/")) {
      signals.push({
        type: "legacy-parent-spec",
        path: filePath,
        detail: `Legacy parent_spec URL containing '/specs/templates/' found in '${filePath}'`
      });
    }
    const l1Match = frontmatter.match(/iNNfo_V_0-[12]-[0-9]+|defiNNe_V_0-1-0/i);
    if (l1Match) {
      signals.push({
        type: "legacy-l1-parent",
        path: filePath,
        detail: `Legacy L1/L0 specification parent '${l1Match[0]}' found in '${filePath}' (expected 'iNNfo_V_0-3-0' or 'defiNNition_V_0-1-0')`
      });
    }
  }
  signals.push(...await detectLegacyLayout(r));
  if (signals.length === 0) {
    return { kind: "current" };
  }
  const kind = hasCurrentSignal ? "mixed" : "legacy";
  const hint = "Run 'nn-upgrade' (or 'node skills/nn-upgrade/scripts/migrate-domain.js') to migrate this domain to the canonical domaiNN/kNNowledge layout.";
  return { kind, signals, hint };
}
