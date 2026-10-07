/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-core/src/naming/index.ts
 * Regenerate: node scripts/build-preflight-primitives.mjs
 * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).
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

// iNNfo/packages/innfo-core/src/naming/index.ts
var index_exports = {};
__export(index_exports, {
  ENTRYPOINT_FILENAME: () => ENTRYPOINT_FILENAME,
  IGNORED_DIRECTORIES: () => IGNORED_DIRECTORIES,
  SIDECAR_BLUEPRINT: () => SIDECAR_BLUEPRINT,
  SPEC_FILENAME: () => SPEC_FILENAME,
  blueprintNameOf: () => blueprintNameOf,
  checkNameInvariant: () => checkNameInvariant,
  checkPathBudget: () => checkPathBudget,
  compareMembers: () => compareMembers,
  displayStem: () => displayStem,
  ensureNNFilename: () => ensureNNFilename,
  familyOf: () => familyOf,
  formatMemberName: () => formatMemberName,
  formatNNName: () => formatNNName,
  formatUtcStamp: () => formatUtcStamp,
  isExcludedPath: () => isExcludedPath,
  isModelCandidate: () => isModelCandidate,
  isNNName: () => isNNName,
  isSidecarName: () => isSidecarName,
  nextStamp: () => nextStamp,
  parentSpecNameOf: () => parentSpecNameOf,
  parseName: () => parseName,
  procedureIdOf: () => procedureIdOf,
  rawPathOfSidecar: () => rawPathOfSidecar,
  roleOf: () => roleOf,
  sidecarPathOf: () => sidecarPathOf
});
module.exports = __toCommonJS(index_exports);

// iNNfo/packages/innfo-core/src/naming/contract.ts
var ENTRYPOINT_FILENAME = "domaiNN_NN.md";
var SPEC_FILENAME = "spec_NN.md";
var SIDECAR_BLUEPRINT = "sidecar";
var NN_SUFFIX_RE = /_NN\.md$/i;
var SIDECAR_PATH_RE = /^(.*\.[^./\\]+)_sidecar_NN\.md$/i;
var STAMP_SUFFIX_RE = /^(.+)_(\d{8}T\d{6}Z)(?:-(\d+))?$/;
function baseOf(path) {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? path : path.slice(i + 1);
}
function parseName(basename) {
  if (NN_SUFFIX_RE.test(basename)) {
    const stem2 = basename.replace(NN_SUFFIX_RE, "");
    const sidecar = SIDECAR_PATH_RE.exec(basename);
    return sidecar ? { kind: "nn", basename, stem: stem2, sidecarOf: sidecar[1] } : { kind: "nn", basename, stem: stem2 };
  }
  const dot = basename.lastIndexOf(".");
  const hasExt = dot > 0;
  const stem = hasExt ? basename.slice(0, dot) : basename;
  const ext = hasExt ? basename.slice(dot + 1) : "";
  const m = STAMP_SUFFIX_RE.exec(stem);
  if (!m) return { kind: "file", basename, key: stem, ext };
  return {
    kind: "file",
    basename,
    key: m[1],
    ext,
    stamp: { stamp: m[2], seq: m[3] ? Number(m[3]) : 1 }
  };
}
function formatNNName(stem, blueprint) {
  const s = stem.toLowerCase();
  const bp = blueprint.toLowerCase();
  const conforms = s === bp || s.endsWith(`_${bp}`);
  return conforms ? `${stem}_NN.md` : `${stem}_${blueprint}_NN.md`;
}
function formatMemberName(key, ext, stamp) {
  const suffix = stamp ? `_${stamp.stamp}${stamp.seq > 1 ? `-${stamp.seq}` : ""}` : "";
  return `${key}${suffix}${ext ? `.${ext}` : ""}`;
}
function sidecarPathOf(rawPath) {
  return `${rawPath}_sidecar_NN.md`;
}
function rawPathOfSidecar(sidecarPath) {
  const m = SIDECAR_PATH_RE.exec(sidecarPath);
  return m ? m[1] : null;
}
function displayStem(basename) {
  if (NN_SUFFIX_RE.test(basename)) return basename.replace(NN_SUFFIX_RE, "");
  return basename.replace(/\.md$/i, "");
}
function procedureIdOf(basename) {
  return displayStem(baseOf(basename)).replace(/_procedures$/i, "").toLowerCase().replace(/_/g, "-");
}
var IGNORED_DIRECTORIES = /* @__PURE__ */ new Set(["backups", "archive", "specs"]);
var NON_KNOWLEDGE_BLUEPRINT_RE = /^(cognnitive|workspace|procedures|sources|artifacts|sidecar|changes)(?:_|$)/i;
function segmentsOf(path) {
  return path.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
}
function roleOf(i) {
  const base = baseOf(i.path);
  const parsed = parseName(base);
  if (parsed.kind === "file") return i.hasSidecar ? "source" : "artifact";
  if (parsed.sidecarOf !== void 0) return "sidecar";
  const lower = base.toLowerCase();
  if (lower === ENTRYPOINT_FILENAME.toLowerCase()) return "entrypoint";
  if (lower === SPEC_FILENAME.toLowerCase()) return "spec";
  const bp = NON_KNOWLEDGE_BLUEPRINT_RE.exec((i.parentSpecName ?? "").trim())?.[1].toLowerCase();
  switch (bp) {
    case "cognnitive":
      return "lineage-record";
    case "sidecar":
      return "sidecar";
    case "changes":
      return "changeset";
    case "procedures":
      return parsed.stem.toLowerCase() === "procedures" ? "catalog" : "procedure";
    case "workspace":
    case "sources":
    case "artifacts":
      return "catalog";
    default:
      return "knowledge";
  }
}
function isExcludedPath(path) {
  const segs = segmentsOf(path);
  if (segs.length > 0 && IGNORED_DIRECTORIES.has(segs[0])) return true;
  return segs.some((s) => s === "archive" || s === "staging" || s.startsWith(".") && s !== "..");
}
function familyOf(path) {
  const normalized = path.replace(/\\/g, "/");
  const parsed = parseName(baseOf(normalized));
  if (parsed.kind !== "file") return null;
  const slash = normalized.lastIndexOf("/");
  return { dir: slash < 0 ? "" : normalized.slice(0, slash), key: parsed.key, ext: parsed.ext };
}
function compareMembers(a, b) {
  const pa = parseName(baseOf(a));
  const pb = parseName(baseOf(b));
  const sa = pa.kind === "file" ? pa.stamp : void 0;
  const sb = pb.kind === "file" ? pb.stamp : void 0;
  if (!sa && !sb) return 0;
  if (!sa) return -1;
  if (!sb) return 1;
  if (sa.stamp !== sb.stamp) return sa.stamp < sb.stamp ? -1 : 1;
  return sa.seq - sb.seq;
}
var pad = (n, width = 2) => String(n).padStart(width, "0");
function formatUtcStamp(at) {
  return `${pad(at.getUTCFullYear(), 4)}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`;
}
function nextStamp(at, latest) {
  const now = formatUtcStamp(at);
  if (!latest || latest.stamp < now) return { stamp: now, seq: 1 };
  return { stamp: latest.stamp, seq: latest.seq + 1 };
}
var WIN32_PATH_LIMIT = 259;
function checkPathBudget(absPath, platform) {
  if (platform === "win32" && absPath.length > WIN32_PATH_LIMIT) {
    return { ok: false, limit: WIN32_PATH_LIMIT, length: absPath.length };
  }
  return { ok: true };
}
function parentSpecNameOf(frontmatter) {
  const parentSpec = frontmatter["parent_spec"];
  if (!parentSpec) return void 0;
  if (typeof parentSpec === "string") return parentSpec;
  if (typeof parentSpec === "object") {
    const name = parentSpec.name;
    return typeof name === "string" ? name : void 0;
  }
  return void 0;
}
function isModelCandidate(f) {
  if (f.frontmatter["level"] !== 3) return false;
  if (!f.frontmatter["parent_spec"]) return false;
  if (isExcludedPath(f.path)) return false;
  if (parseName(baseOf(f.path)).kind !== "nn") return false;
  return roleOf({ path: f.path, parentSpecName: parentSpecNameOf(f.frontmatter) }) === "knowledge";
}
var VERSION_TOKEN_RE = /_V_\d+-\d+-\d+/i;
var STRUCTURAL_STEM_RE = /^(?:iNNfo|defiNNition|defiNNe|meta-bluepriNNt)(?:_V_\d+-\d+-\d+)?$/i;
function blueprintNameOf(parentSpecName) {
  return parentSpecName.trim().replace(/_V_\d+-\d+-\d+$/i, "");
}
function checkNameInvariant(path, bp) {
  const base = baseOf(path);
  const parsed = parseName(base);
  if (parsed.kind !== "nn") return null;
  const lower = base.toLowerCase();
  if (lower === ENTRYPOINT_FILENAME.toLowerCase() || lower === SPEC_FILENAME.toLowerCase()) return null;
  if (STRUCTURAL_STEM_RE.test(parsed.stem)) return null;
  const hasVersion = VERSION_TOKEN_RE.test(parsed.stem);
  const stem = parsed.stem.replace(VERSION_TOKEN_RE, "");
  const blueprint = bp?.trim();
  if (!blueprint) return hasVersion ? { expected: `${stem}_NN.md` } : null;
  const s = stem.toLowerCase();
  const b = blueprint.toLowerCase();
  const conforms = !hasVersion && (s === b || s.endsWith(`_${b}`));
  return conforms ? null : { expected: formatNNName(stem, blueprint) };
}
function isNNName(nameOrPath) {
  return NN_SUFFIX_RE.test(baseOf(nameOrPath));
}
function isSidecarName(nameOrPath) {
  return SIDECAR_PATH_RE.test(nameOrPath);
}
function ensureNNFilename(name) {
  if (NN_SUFFIX_RE.test(name)) return name;
  return /_NN$/i.test(name) ? `${name}.md` : `${name}_NN.md`;
}
