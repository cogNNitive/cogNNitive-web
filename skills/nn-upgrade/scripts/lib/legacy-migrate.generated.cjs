/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-core/src/legacy/index.ts
 * Regenerate: node scripts/build-preflight-primitives.mjs
 * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).
 */
// legacy:nn-rename/quarantine
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

// iNNfo/packages/innfo-core/src/legacy/index.ts
var index_exports = {};
__export(index_exports, {
  detectLegacy: () => detectLegacy,
  planMigration: () => planMigration
});
module.exports = __toCommonJS(index_exports);

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
  if (signals.length === 0) {
    return { kind: "current" };
  }
  const kind = hasCurrentSignal ? "mixed" : "legacy";
  const hint = "Run 'nn-upgrade' (or 'node skills/nn-upgrade/scripts/migrate-domain.js') to migrate this domain to the canonical domaiNN/kNNowledge layout.";
  return { kind, signals, hint };
}

// iNNfo/packages/innfo-core/src/legacy/reader.ts
var IGNORED_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", "dist", "coverage", "backups", "archive", "specs"]);
async function readLegacyDomain(r) {
  const files = {};
  const opaque = [];
  async function walk(dir, depth = 0) {
    if (depth > 10) return;
    const entries = await r.list(dir);
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry) && !dir) continue;
      const relPath = dir ? `${dir}/${entry}` : entry;
      if (r.isOpaque && await r.isOpaque(relPath)) {
        opaque.push(relPath);
        continue;
      }
      const content = await r.read(relPath);
      if (content !== null) {
        files[relPath] = content;
      } else {
        await walk(relPath, depth + 1);
      }
    }
  }
  await walk("");
  return { files, opaque };
}

// iNNfo/packages/innfo-core/src/legacy/schema-maps/workspace.ts
var workspaceSchemaMap = {
  blueprint: "workspace",
  from: {
    versions: ["0.1.0", "0.2.0", "0.3.0", "0.4.0", "0.5.0"],
    canonicalConcepts: ["Workspace", "Models", "Templates"]
  },
  to: {
    name: "domaiNN",
    version: "0.1.0"
  },
  concepts: {
    rename: {
      Workspace: "domaiNN",
      Models: "kNNowledge",
      Templates: "bluepriNNts"
    }
  },
  fields: {
    rename: {
      template_version: "blueprint_version",
      template_name: "blueprint_name",
      models_dir: "knowledge_dir",
      templates_dir: "blueprints_dir",
      model_version: "knowledge_version",
      target_template: "target_blueprint"
    }
  },
  knowledgeBump: "minor"
};

// iNNfo/packages/innfo-core/src/legacy/schema-maps/index.ts
var SCHEMA_MAPS = {
  workspace: workspaceSchemaMap
};
function getSchemaMap(blueprintName) {
  const normalized = blueprintName.toLowerCase().trim();
  return SCHEMA_MAPS[normalized];
}
function bumpSemver(version, bump) {
  if (bump === "none") return version;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) return version;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const rest = match[4] || "";
  if (bump === "minor") {
    return `${major}.${minor + 1}.0${rest}`;
  } else if (bump === "patch") {
    return `${major}.${minor}.${patch + 1}${rest}`;
  }
  return version;
}
function applySchemaMap(content, map, currentVersion) {
  let result = content;
  let bumpedVersion = void 0;
  if (currentVersion) {
    bumpedVersion = bumpSemver(currentVersion, map.knowledgeBump);
    result = result.replace(
      /^(\s*knowledge_version\s*:\s*["'])[^"']+(["'])/m,
      `$1${bumpedVersion}$2`
    );
    result = result.replace(
      /^(\s*model_version\s*:\s*["'])[^"']+(["'])/m,
      `$1${bumpedVersion}$2`
    );
  }
  for (const canonicalConcept of map.from.canonicalConcepts) {
    const targetName = map.concepts.rename[canonicalConcept];
    if (targetName) {
      result = result.replace(
        new RegExp(`^(#{1,6}\\s+)${canonicalConcept}(\\s*)$`, "gm"),
        `$1${targetName}$2`
      );
      result = result.replace(
        new RegExp(`^(\\s*-\\s+)${canonicalConcept}(\\s+Definition|\\s+DefiNNition)`, "gm"),
        `$1${targetName}$2`
      );
      result = result.replace(
        new RegExp(`\\[\\[#${canonicalConcept}\\]\\]`, "g"),
        `[[#${targetName}]]`
      );
    }
  }
  if (map.fields.rename) {
    for (const [oldField, newField] of Object.entries(map.fields.rename)) {
      result = result.replace(new RegExp(`^(\\s*)${oldField}(\\s*:)`, "gm"), `$1${newField}$2`);
      result = result.replace(new RegExp(`^(\\s*-\\s*)${oldField}(::)`, "gm"), `$1${newField}$2`);
    }
  }
  return { migratedContent: result, bumpedVersion };
}

// iNNfo/packages/innfo-core/src/legacy/language-map.ts
var OVERVIEW_ROOT_RE2 = /_base_[a-z0-9]+\.md$/i;
function migratePath(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  const segments = norm.split("/");
  const fileName = segments[segments.length - 1];
  if (segments.length === 1) {
    if (fileName.toLowerCase().startsWith("workspace") && fileName.toLowerCase().endsWith(".md") || OVERVIEW_ROOT_RE2.test(fileName)) {
      return "domaiNN_NN.md";
    }
  }
  if (segments[0] === "models") {
    return ["kNNowledge", ...segments.slice(1)].join("/");
  }
  if (segments[0] === "templates") {
    return ["specs", "bluepriNNts", ...segments.slice(1)].join("/");
  }
  if (segments[0] === "specs" && segments[1] === "templates") {
    return ["specs", "bluepriNNts", ...segments.slice(2)].join("/");
  }
  return norm;
}
function migrateContent(content, filePath) {
  const normPath = filePath.replace(/\\/g, "/");
  if (normPath.endsWith(".json")) {
    try {
      const obj = JSON.parse(content);
      const migratedObj = migrateJsonObject(obj);
      return JSON.stringify(migratedObj, null, 2) + "\n";
    } catch {
    }
  }
  let result = content;
  result = result.replace(/^(\s*)model_version(\s*:)/gm, "$1knowledge_version$2");
  result = result.replace(/^(\s*)template_version(\s*:)/gm, "$1blueprint_version$2");
  result = result.replace(/^(\s*)template_name(\s*:)/gm, "$1blueprint_name$2");
  result = result.replace(/^(\s*)target_template(\s*:)/gm, "$1target_blueprint$2");
  result = result.replace(
    /^(\s*)models_dir(\s*:\s*["']?)(?:models|\.\/models)(["']?)/gm,
    "$1knowledge_dir$2kNNowledge$3"
  );
  result = result.replace(/^(\s*)models_dir(\s*:)/gm, "$1knowledge_dir$2");
  result = result.replace(
    /^(\s*)templates_dir(\s*:\s*["']?)(?:templates|specs\/templates|\.\/templates)(["']?)/gm,
    "$1blueprints_dir$2specs/bluepriNNts$3"
  );
  result = result.replace(/^(\s*)templates_dir(\s*:)/gm, "$1blueprints_dir$2");
  result = result.replace(/(\btype::\s*)model\b/gi, "$1knowledge");
  result = result.replace(/^(#{1,6}\s+(?:NN\s+)?)Workspace(\b[^\r\n]*)$/gm, "$1domaiNN$2");
  result = result.replace(/^(#{1,6}\s+(?:NN\s+)?)Models(\b[^\r\n]*)$/gm, "$1kNNowledge$2");
  result = result.replace(/^(#{1,6}\s+(?:NN\s+)?)Templates(\b[^\r\n]*)$/gm, "$1bluepriNNts$2");
  result = result.replace(/^(\s*-\s+)Workspace(\s+Definition|\s+DefiNNition)/gm, "$1domaiNN$2");
  result = result.replace(/^(\s*-\s+)Models(\s+Definition|\s+DefiNNition)/gm, "$1kNNowledge$2");
  result = result.replace(/^(\s*-\s+)Templates(\s+Definition|\s+DefiNNition)/gm, "$1bluepriNNts$2");
  result = result.replace(/\[\[#?Workspace\]\]/g, (m) => m.includes("#") ? "[[#domaiNN]]" : "[[domaiNN]]");
  result = result.replace(/\[\[#?Models\]\]/g, (m) => m.includes("#") ? "[[#kNNowledge]]" : "[[kNNowledge]]");
  result = result.replace(/\[\[#?Templates\]\]/g, (m) => m.includes("#") ? "[[#bluepriNNts]]" : "[[bluepriNNts]]");
  result = result.replace(/(\b(?:path|sources|fuentes|model_ref|model|derived_from)::\s*(?:\[\s*)?)(?:\.\/)?models\//g, "$1kNNowledge/");
  result = result.replace(/(\b(?:path|sources|fuentes|model_ref|model|derived_from)::\s*(?:\[\s*)?)(?:\.\/)?specs\/templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\b(?:path|sources|fuentes|model_ref|model|derived_from)::\s*(?:\[\s*)?)(?:\.\/)?templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\bpath::\s*)workspace_NN\.md/g, "$1domaiNN_NN.md");
  result = result.replace(/(\bpath::\s*)workspace\.md/g, "$1domaiNN_NN.md");
  result = result.replace(/(["'])(?:\.\/)?models\//g, "$1kNNowledge/");
  result = result.replace(/(["'])(?:\.\/)?specs\/templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(["'])(?:\.\/)?templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\]\(\.\/|\()models\//g, "$1kNNowledge/");
  result = result.replace(/(\]\(\.\/|\()specs\/templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\]\(\.\/|\()templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\[\[(?:\.\/)?)models\//g, "$1kNNowledge/");
  result = result.replace(/(\[\[(?:\.\/)?)specs\/templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(/(\[\[(?:\.\/)?)templates\//g, "$1specs/bluepriNNts/");
  result = result.replace(
    /\/specs\/(?:templates|bluepriNNts)\/workspace(?:_spec_NN\.md|\/spec_NN\.md)/g,
    "/specs/bluepriNNts/domaiNN/spec_NN.md"
  );
  result = result.replace(
    /\/bluepriNNts\/workspace(?:_spec_NN\.md|\/spec_NN\.md)/g,
    "/bluepriNNts/domaiNN/spec_NN.md"
  );
  result = result.replace(
    /\/specs\/templates\/workspace_spec_NN\.md/g,
    "/specs/bluepriNNts/domaiNN/spec_NN.md"
  );
  result = result.replace(
    /\/templates\/workspace_spec_NN\.md/g,
    "/specs/bluepriNNts/domaiNN/spec_NN.md"
  );
  result = result.replace(/\/specs\/templates\//g, "/specs/bluepriNNts/");
  result = result.replace(/\/specs\/iNNfo_V_0-[12]-[0-9]+_NN\.md/g, "/specs/iNNfo_V_0-3-0_NN.md");
  result = result.replace(/\/specs\/defiNNe_V_0-1-0_NN\.md/g, "/specs/defiNNition_V_0-1-0_NN.md");
  result = result.replace(
    /(parent_spec:\s*\r?\n(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]+name:\s*["']?)workspace(["']?)/g,
    "$1domaiNN$2"
  );
  result = result.replace(/^(\s*blueprint_name\s*:\s*["']?)workspace(["']?)/gm, "$1domaiNN$2");
  return result;
}
function migrateJsonObject(value) {
  if (Array.isArray(value)) {
    return value.map(migrateJsonObject);
  }
  if (value && typeof value === "object") {
    const res = {};
    for (const [k, v] of Object.entries(value)) {
      let targetKey = k;
      if (k === "source_model") targetKey = "source_knowledge";
      else if (k === "source_model_version") targetKey = "source_knowledge_version";
      else if (k === "model") targetKey = "knowledge";
      else if (k === "model_version") targetKey = "knowledge_version";
      else if (k === "target_template") targetKey = "target_blueprint";
      else if (k === "template_version") targetKey = "blueprint_version";
      else if (k === "template_name") targetKey = "blueprint_name";
      res[targetKey] = migrateJsonObject(v);
    }
    return res;
  }
  return value;
}
function computePlanHash(ops) {
  const serialized = JSON.stringify(ops);
  let h1 = 3735928559 ^ 0;
  let h2 = 1103547991 ^ 0;
  for (let i = 0; i < serialized.length; i++) {
    const ch = serialized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex1}${hex2}`;
}
function extractBlueprintName(content, filePath) {
  const normPath = filePath.replace(/\\/g, "/");
  if (normPath === "workspace_NN.md" || normPath === "domaiNN_NN.md" || OVERVIEW_ROOT_RE2.test(normPath)) {
    return "domaiNN";
  }
  const match = content.match(/^\s*(?:blueprint_name|template_name)\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/m);
  if (match) {
    if (match[1] === "workspace") return "domaiNN";
    return match[1];
  }
  return null;
}
function extractVersion(content) {
  const match = content.match(/^\s*(?:knowledge_version|model_version|blueprint_version|template_version)\s*:\s*["']?([0-9.]+)["']?/m);
  return match ? match[1] : void 0;
}
async function planMigration(r, deps) {
  const detection = await detectLegacy(r);
  if (detection.kind === "current") {
    return {
      status: "noop",
      ops: [],
      problems: [],
      report: {
        renamedFiles: [],
        rewrittenFiles: [],
        customBlueprints: [],
        unmappedBlueprints: [],
        problems: [],
        summary: "Domain is already up to date with the canonical layout."
      },
      planHash: computePlanHash([])
    };
  }
  const legacyDomain = await readLegacyDomain(r);
  const problems = [];
  const renamedFiles = [];
  const rewrittenFiles = [];
  const customBlueprints = /* @__PURE__ */ new Set();
  const unmappedBlueprints = /* @__PURE__ */ new Set();
  for (const [filePath, content] of Object.entries(legacyDomain.files)) {
    if (content.startsWith("---")) {
      const secondDashes = content.indexOf("\n---", 3);
      if (secondDashes === -1) {
        problems.push({
          path: filePath,
          message: `Malformed frontmatter in '${filePath}': missing closing '---'`,
          severity: "error"
        });
      } else {
        const fm = content.slice(3, secondDashes);
        const openBrackets = (fm.match(/\[/g) || []).length;
        const closeBrackets = (fm.match(/\]/g) || []).length;
        const quotes = (fm.match(/"/g) || []).length;
        if (openBrackets !== closeBrackets || quotes % 2 !== 0) {
          problems.push({
            path: filePath,
            message: `Malformed YAML frontmatter in '${filePath}'`,
            severity: "error"
          });
        }
      }
    }
  }
  if (problems.some((p) => p.severity === "error")) {
    return {
      status: "blocked",
      ops: [],
      problems,
      report: {
        renamedFiles: [],
        rewrittenFiles: [],
        customBlueprints: [],
        unmappedBlueprints: [],
        problems,
        summary: "Migration blocked due to malformed file syntax."
      },
      planHash: computePlanHash([])
    };
  }
  const migratedFiles = {};
  const ops = [];
  for (const [origPath, origContent] of Object.entries(legacyDomain.files)) {
    const targetPath = migratePath(origPath);
    let content = migrateContent(origContent, origPath);
    const bpName = extractBlueprintName(origContent, origPath);
    if (bpName) {
      const schemaMap = getSchemaMap(bpName);
      if (schemaMap) {
        const curVersion = extractVersion(origContent);
        const schemaApplied = applySchemaMap(content, schemaMap, curVersion);
        content = schemaApplied.migratedContent;
      } else if (bpName !== "workspace") {
        customBlueprints.add(bpName);
      }
    }
    migratedFiles[targetPath] = content;
    if (targetPath !== origPath) {
      renamedFiles.push({ from: origPath, to: targetPath });
      ops.push({ op: "move", from: origPath, to: targetPath });
    }
    if (content !== origContent || targetPath !== origPath) {
      rewrittenFiles.push(targetPath);
      ops.push({ op: "write", path: targetPath, content });
    }
  }
  for (const opaquePath of legacyDomain.opaque || []) {
    const targetPath = migratePath(opaquePath);
    if (targetPath !== opaquePath) {
      renamedFiles.push({ from: opaquePath, to: targetPath });
      ops.push({ op: "move", from: opaquePath, to: targetPath });
    }
  }
  const migratedTree = { files: migratedFiles };
  const validationProblems = deps.validate(migratedTree, deps.targets);
  problems.push(...validationProblems);
  const isBlocked = problems.some((p) => p.severity === "error");
  if (ops.length === 0 && !isBlocked) {
    return {
      status: "noop",
      ops: [],
      problems,
      report: {
        renamedFiles: [],
        rewrittenFiles: [],
        customBlueprints: Array.from(customBlueprints),
        unmappedBlueprints: Array.from(unmappedBlueprints),
        problems,
        summary: "Domain is already up to date with the canonical layout."
      },
      planHash: computePlanHash([])
    };
  }
  const report = {
    renamedFiles,
    rewrittenFiles,
    customBlueprints: Array.from(customBlueprints),
    unmappedBlueprints: Array.from(unmappedBlueprints),
    problems,
    summary: isBlocked ? `Migration blocked with ${problems.length} problem(s).` : `Migration planned: ${renamedFiles.length} moves, ${rewrittenFiles.length} writes.`
  };
  ops.sort((a, b) => {
    const keyA = a.op === "move" ? `move:${a.from}->${a.to}` : `write:${a.path}`;
    const keyB = b.op === "move" ? `move:${b.from}->${b.to}` : `write:${b.path}`;
    return keyA.localeCompare(keyB);
  });
  const planHash = computePlanHash(ops);
  return {
    status: isBlocked ? "blocked" : "ready",
    ops,
    problems,
    report,
    planHash
  };
}
