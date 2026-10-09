#!/usr/bin/env node
/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: scripts/skills-manager.js (+ scripts/lib/*)
 * Regenerate: node scripts/build-skills-manager-bundle.mjs
 * Drift-guarded by scripts/verify.js (build-skills-manager-bundle --check).
 */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// scripts/lib/atomic-fs.js
var require_atomic_fs = __commonJS({
  "scripts/lib/atomic-fs.js"(exports2, module2) {
    var fs = require("fs");
    var path2 = require("path");
    var { spawnSync } = require("child_process");
    function saveJsonAtomic(filePath, data, indent = 2) {
      const dir = path2.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = path2.join(dir, `.${path2.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, indent), "utf-8");
        fs.renameSync(tmp, filePath);
      } catch (err) {
        try {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch (_) {
        }
        throw err;
      }
    }
    function copyDirAtomic(src, dest) {
      const parent = path2.dirname(dest);
      fs.mkdirSync(parent, { recursive: true });
      const staged = path2.join(parent, `.${path2.basename(dest)}.new-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      fs.rmSync(staged, { recursive: true, force: true });
      try {
        fs.cpSync(src, staged, { recursive: true });
        fs.renameSync(staged, dest);
      } catch (err) {
        fs.rmSync(staged, { recursive: true, force: true });
        throw err;
      }
    }
    function replaceDirAtomic(src, dest) {
      const parent = path2.dirname(dest);
      fs.mkdirSync(parent, { recursive: true });
      const name = path2.basename(dest);
      const id = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const staged = path2.join(parent, `.${name}.new-${id}`);
      const backup = path2.join(parent, `.${name}.bak-${id}`);
      fs.rmSync(staged, { recursive: true, force: true });
      fs.rmSync(backup, { recursive: true, force: true });
      const safeRename = (from, to) => {
        try {
          fs.renameSync(from, to);
        } catch (err) {
          if (err.code === "EBUSY" || err.code === "EPERM") {
            throw new Error(
              `Directory "${to}" is currently locked by another process (VS Code, terminal, or antivirus).
Please close any open files or editors accessing that folder and retry.`
            );
          }
          throw err;
        }
      };
      try {
        fs.cpSync(src, staged, { recursive: true });
        if (fs.existsSync(dest)) {
          safeRename(dest, backup);
        }
        try {
          safeRename(staged, dest);
          const backupNodeModules = path2.join(backup, "node_modules");
          const destNodeModules = path2.join(dest, "node_modules");
          if (fs.existsSync(backupNodeModules) && !fs.existsSync(destNodeModules)) {
            try {
              safeRename(backupNodeModules, destNodeModules);
            } catch (_) {
              try {
                fs.cpSync(backupNodeModules, destNodeModules, { recursive: true });
              } catch (_2) {
              }
            }
          }
          fs.rmSync(backup, { recursive: true, force: true });
        } catch (err) {
          if (fs.existsSync(backup) && !fs.existsSync(dest)) {
            try {
              safeRename(backup, dest);
            } catch (_) {
            }
          }
          throw err;
        }
      } finally {
        fs.rmSync(staged, { recursive: true, force: true });
      }
    }
    function extractTarball(tarFile, destDir) {
      fs.mkdirSync(destDir, { recursive: true });
      const res = spawnSync("tar", ["-xzf", tarFile, "-C", destDir], { cwd: destDir, encoding: "utf-8" });
      if (res.status !== 0) {
        throw new Error(`tar extraction failed: ${(res.stderr || res.stdout || "").trim()}`);
      }
    }
    function copyDirRecursive(src, dest) {
      if (!fs.existsSync(src)) return;
      const base = path2.basename(src);
      if (base === "node_modules" || base.startsWith(".")) return;
      if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
          copyDirRecursive(path2.join(src, entry), path2.join(dest, entry));
        }
      } else {
        fs.copyFileSync(src, dest);
      }
    }
    function mirrorDir(src, dest, isIncluded = () => true) {
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(dest, { recursive: true });
      const destEntries = fs.readdirSync(dest, { withFileTypes: true });
      for (const entry of destEntries) {
        if (!isIncluded(entry.name)) continue;
        const destPath = path2.join(dest, entry.name);
        const srcPath = path2.join(src, entry.name);
        if (!fs.existsSync(srcPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        } else {
          const srcStat = fs.statSync(srcPath);
          const isSrcDir = srcStat.isDirectory();
          const isDestDir = entry.isDirectory();
          if (isSrcDir !== isDestDir) {
            fs.rmSync(destPath, { recursive: true, force: true });
          }
        }
      }
      const srcEntries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of srcEntries) {
        if (!isIncluded(entry.name)) continue;
        const srcPath = path2.join(src, entry.name);
        const destPath = path2.join(dest, entry.name);
        if (entry.isDirectory()) {
          mirrorDir(srcPath, destPath, isIncluded);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    module2.exports = {
      saveJsonAtomic,
      copyDirAtomic,
      replaceDirAtomic,
      extractTarball,
      copyDirRecursive,
      mirrorDir
    };
  }
});

// skills/nn-preflight/scripts/lib/projection.js
var require_projection = __commonJS({
  "skills/nn-preflight/scripts/lib/projection.js"(exports2, module2) {
    var fs = require("fs");
    var path2 = require("path");
    var crypto = require("crypto");
    function isProjectableName(name) {
      return typeof name === "string" && !name.startsWith(".") && name !== "node_modules";
    }
    function classifyProjection(dest, src) {
      let lstat;
      try {
        lstat = fs.lstatSync(dest);
      } catch (err) {
        if (err.code === "ENOENT") {
          return "absent";
        }
        throw err;
      }
      if (lstat.isSymbolicLink()) {
        let rawTarget;
        try {
          rawTarget = fs.readlinkSync(dest);
        } catch {
          return "link-dangling";
        }
        const resolvedTarget = path2.isAbsolute(rawTarget) ? path2.resolve(rawTarget) : path2.resolve(path2.dirname(dest), rawTarget);
        const canonicalResolved = path2.resolve(src);
        let targetExists = false;
        try {
          targetExists = fs.existsSync(dest);
        } catch {
          targetExists = false;
        }
        if (!targetExists) {
          return "link-dangling";
        }
        let realDestTarget;
        try {
          realDestTarget = path2.resolve(fs.realpathSync(dest));
        } catch {
          realDestTarget = resolvedTarget;
        }
        let realCanonical;
        try {
          realCanonical = path2.resolve(fs.realpathSync(src));
        } catch {
          realCanonical = canonicalResolved;
        }
        if (resolvedTarget.toLowerCase() === canonicalResolved.toLowerCase() || realDestTarget.toLowerCase() === realCanonical.toLowerCase()) {
          return "link-ok";
        }
        return "link-wrong";
      }
      if (lstat.isDirectory()) {
        return "dir";
      }
      return "dir";
    }
    function hashTree(dir, isIncluded = isProjectableName) {
      if (!fs.existsSync(dir)) {
        return null;
      }
      const entries = [];
      function walk(currentDir, baseDir) {
        let items;
        try {
          items = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const item of items) {
          if (!isIncluded(item.name)) continue;
          const fullPath = path2.join(currentDir, item.name);
          const relPath = path2.relative(baseDir, fullPath).replace(/\\/g, "/");
          if (item.isDirectory()) {
            walk(fullPath, baseDir);
          } else if (item.isFile()) {
            try {
              const content = fs.readFileSync(fullPath);
              const fileHash = crypto.createHash("sha256").update(content).digest("hex");
              entries.push({ relPath, hash: fileHash });
            } catch {
            }
          }
        }
      }
      walk(dir, dir);
      entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
      const manifest = entries.map((e) => `${e.relPath}:${e.hash}`).join("\n");
      return crypto.createHash("sha256").update(manifest, "utf-8").digest("hex");
    }
    module2.exports = {
      isProjectableName,
      classifyProjection,
      hashTree
    };
  }
});

// scripts/lib/github-client.js
var require_github_client = __commonJS({
  "scripts/lib/github-client.js"(exports2, module2) {
    var fs = require("fs");
    var path2 = require("path");
    var USER_AGENT = "actioNN-Skills-Updater";
    var RATE_LIMIT_HINT = "set GITHUB_TOKEN to raise the rate limit";
    function authHeaders() {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.WEB_RELEASE_TOKEN;
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    function rateLimited(status) {
      return status === 403 || status === 429;
    }
    async function apiRequest(url) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...authHeaders() } });
        const body = await res.text();
        let data = null;
        try {
          data = JSON.parse(body);
        } catch (err) {
        }
        return { status: res.status, data };
      } catch (err) {
        return { status: 0, data: null, error: err.message };
      }
    }
    async function fetchString(url, redirectsLeft = 5) {
      let currentUrl = url;
      let left = redirectsLeft;
      for (; ; ) {
        const res = await fetch(currentUrl, {
          redirect: "manual",
          headers: { "User-Agent": USER_AGENT, ...authHeaders() }
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          if (left <= 0) throw new Error(`Too many redirects fetching ${currentUrl}`);
          currentUrl = new URL(res.headers.get("location"), currentUrl).toString();
          left -= 1;
          continue;
        }
        if (res.status !== 200) {
          throw new Error(`Failed to fetch ${currentUrl}, status: ${res.status}`);
        }
        return res.text();
      }
    }
    function fetchJson(url) {
      return fetchString(url).then((text) => JSON.parse(text));
    }
    async function downloadFile(url, destPath, redirectsLeft = 5) {
      const dir = path2.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      let currentUrl = url;
      let left = redirectsLeft;
      for (; ; ) {
        const res = await fetch(currentUrl, {
          redirect: "manual",
          headers: { "User-Agent": USER_AGENT, ...authHeaders() }
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          if (left <= 0) throw new Error(`Too many redirects downloading ${currentUrl}`);
          currentUrl = new URL(res.headers.get("location"), currentUrl).toString();
          left -= 1;
          continue;
        }
        if (res.status !== 200) {
          throw new Error(`Failed to download ${currentUrl}, status: ${res.status}`);
        }
        try {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(destPath, buffer);
        } catch (err) {
          if (fs.existsSync(destPath)) {
            try {
              fs.unlinkSync(destPath);
            } catch (_) {
            }
          }
          throw err;
        }
        return;
      }
    }
    async function resolveRef(repo, ref) {
      const tagRes = await apiRequest(`https://api.github.com/repos/${repo}/git/ref/tags/${ref}`);
      if (tagRes.status === 200 && tagRes.data && tagRes.data.object) {
        let sha = tagRes.data.object.sha;
        if (tagRes.data.object.type === "tag") {
          const peelRes = await apiRequest(`https://api.github.com/repos/${repo}/git/tags/${sha}`);
          if (rateLimited(peelRes.status)) {
            return { error: `rate limit hit peeling annotated tag '${ref}' in ${repo} (HTTP ${peelRes.status}); ${RATE_LIMIT_HINT}` };
          }
          if (peelRes.status !== 200 || !peelRes.data || !peelRes.data.object || !peelRes.data.object.sha) {
            return { error: `could not peel annotated tag '${ref}' in ${repo} (HTTP ${peelRes.status || peelRes.error || "network error"})` };
          }
          sha = peelRes.data.object.sha;
        }
        return { sha, kind: "tag" };
      }
      if (rateLimited(tagRes.status)) {
        return { error: `rate limit hit resolving ref '${ref}' in ${repo} (HTTP ${tagRes.status}); ${RATE_LIMIT_HINT}` };
      }
      const branchRes = await apiRequest(`https://api.github.com/repos/${repo}/git/ref/heads/${ref}`);
      if (branchRes.status === 200 && branchRes.data && branchRes.data.object) {
        return { sha: branchRes.data.object.sha, kind: "branch" };
      }
      if (rateLimited(branchRes.status)) {
        return { error: `rate limit hit resolving ref '${ref}' in ${repo} (HTTP ${branchRes.status}); ${RATE_LIMIT_HINT}` };
      }
      return { error: `ref '${ref}' not found as a tag or branch in ${repo}` };
    }
    module2.exports = {
      USER_AGENT,
      RATE_LIMIT_HINT,
      authHeaders,
      rateLimited,
      apiRequest,
      fetchString,
      fetchJson,
      downloadFile,
      resolveRef
    };
  }
});

// scripts/lib/yaml-parser.js
var require_yaml_parser = __commonJS({
  "scripts/lib/yaml-parser.js"(exports2, module2) {
    function parseScalar(text) {
      const t = text.trim();
      if (t === "") return null;
      if (t.startsWith("[") && t.endsWith("]")) {
        return t.slice(1, -1).split(",").map((p) => p.trim()).filter((p) => p !== "").map((p) => parseScalar(p));
      }
      if (t === "true") return true;
      if (t === "false") return false;
      if (t === "null") return null;
      if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) {
        return t.slice(1, -1);
      }
      return t;
    }
    function parseMappingItem(lines, pos, indent) {
      const line = lines[pos];
      const match = line.text.match(/^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/);
      if (!match) return [null, null, pos + 1];
      const key = match[1];
      const rest = match[2];
      let next = pos + 1;
      let value;
      if (rest === "") {
        if (next < lines.length && lines[next].indent > indent) {
          [value, next] = parseBlock(lines, next, lines[next].indent);
        } else {
          value = null;
        }
      } else {
        value = parseScalar(rest);
      }
      return [key, value, next];
    }
    function parseSequence(lines, pos, indent) {
      const arr = [];
      while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith("- ")) {
        const rest = lines[pos].text.slice(2).trim();
        let next = pos + 1;
        let item;
        if (rest === "") {
          if (next < lines.length && lines[next].indent > indent) {
            [item, next] = parseBlock(lines, next, lines[next].indent);
          } else {
            item = null;
          }
        } else {
          const mapMatch = rest.match(/^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/);
          if (mapMatch) {
            item = {};
            const key = mapMatch[1];
            const value = mapMatch[2];
            if (value === "") {
              if (next < lines.length && lines[next].indent > indent) {
                [item[key], next] = parseBlock(lines, next, lines[next].indent);
              } else {
                item[key] = null;
              }
            } else {
              item[key] = parseScalar(value);
            }
            if (next < lines.length && lines[next].indent > indent) {
              const itemIndent = lines[next].indent;
              while (next < lines.length && lines[next].indent === itemIndent && !lines[next].text.startsWith("- ")) {
                const [k, v, after] = parseMappingItem(lines, next, itemIndent);
                if (k === null) break;
                item[k] = v;
                next = after;
              }
            }
          } else {
            item = parseScalar(rest);
          }
        }
        arr.push(item);
        pos = next;
      }
      return [arr, pos];
    }
    function parseBlock(lines, pos, indent) {
      if (pos >= lines.length) return [{}, pos];
      if (lines[pos].text.startsWith("- ")) {
        return parseSequence(lines, pos, indent);
      }
      const obj = {};
      while (pos < lines.length && lines[pos].indent === indent && !lines[pos].text.startsWith("- ")) {
        const [key, value, next] = parseMappingItem(lines, pos, indent);
        if (key === null) break;
        obj[key] = value;
        pos = next;
      }
      return [obj, pos];
    }
    function parseFocusedYaml(text) {
      const lines = text.split(/\r?\n/).map((raw) => ({ indent: raw.match(/^[ \t]*/)[0].length, text: raw.trim() })).filter((l) => l.text !== "" && !l.text.startsWith("#"));
      const result = {};
      let pos = 0;
      while (pos < lines.length) {
        const [key, value, next] = parseMappingItem(lines, pos, 0);
        if (key === null) {
          pos++;
          continue;
        }
        result[key] = value;
        pos = next;
      }
      return result;
    }
    function parseFrontmatter(text) {
      const lines = text.split(/\r?\n/);
      const open = lines.findIndex((l) => l.trim() === "---");
      let close = -1;
      for (let i = open + 1; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
          close = i;
          break;
        }
      }
      if (open === -1 || close === -1) {
        throw new Error("no YAML frontmatter (--- delimiters) found");
      }
      return lines.slice(open + 1, close).join("\n");
    }
    function parseManifest(text) {
      const doc = parseFocusedYaml(parseFrontmatter(text));
      const bootstrap = doc["agent-bootstrap"];
      if (!bootstrap || typeof bootstrap !== "object") {
        throw new Error("agent-bootstrap block not found in manifest");
      }
      if (!Array.isArray(bootstrap.skills)) {
        throw new Error("agent-bootstrap.skills is not a list");
      }
      const blueprints = Array.isArray(bootstrap.blueprints) ? bootstrap.blueprints : [];
      const workflows = Array.isArray(bootstrap.workflows) ? bootstrap.workflows : [];
      const mcp = Array.isArray(bootstrap.mcp) ? bootstrap.mcp : [];
      const consoleAssets = Array.isArray(bootstrap["console-assets"]) ? bootstrap["console-assets"] : [];
      return {
        version: bootstrap.version,
        entrypoint: bootstrap.entrypoint,
        skills: bootstrap.skills,
        blueprints,
        workflows,
        mcp,
        consoleAssets
      };
    }
    module2.exports = {
      parseScalar,
      parseMappingItem,
      parseSequence,
      parseBlock,
      parseFocusedYaml,
      parseFrontmatter,
      parseManifest
    };
  }
});

// scripts/lib/mcp-config-adapter.js
var require_mcp_config_adapter = __commonJS({
  "scripts/lib/mcp-config-adapter.js"(exports2, module2) {
    var fs = require("fs");
    var path2 = require("path");
    var os = require("os");
    var { saveJsonAtomic } = require_atomic_fs();
    function readJsonClean(filePath) {
      const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
      return JSON.parse(content);
    }
    function writeJsonClean(filePath, data, indent = 2) {
      saveJsonAtomic(filePath, data, indent);
    }
    function registerMcpForOpenCode({ configFile, serverName = "innfo-mcp", bundlePath }) {
      const dir = path2.dirname(configFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      let config = {};
      if (fs.existsSync(configFile)) {
        try {
          config = readJsonClean(configFile);
        } catch {
          config = {};
        }
      }
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        config = {};
      }
      if (!config.$schema) {
        config.$schema = "https://opencode.ai/config.json";
      }
      if (!config.mcp || typeof config.mcp !== "object" || Array.isArray(config.mcp)) {
        config.mcp = {};
      }
      const existing = config.mcp[serverName];
      const targetCommand = ["node", bundlePath];
      if (existing && existing.type === "local" && existing.enabled === true && Array.isArray(existing.command) && existing.command.length === 2 && existing.command[0] === "node" && existing.command[1] === bundlePath) {
        return { agent: "opencode", file: configFile, updated: false };
      }
      config.mcp[serverName] = {
        type: "local",
        command: targetCommand,
        enabled: true
      };
      writeJsonClean(configFile, config);
      return { agent: "opencode", file: configFile, updated: true };
    }
    function registerMcpServersFormat({ agent, configFile, serverName = "innfo-mcp", bundlePath }) {
      const dir = path2.dirname(configFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      let config = {};
      if (fs.existsSync(configFile)) {
        try {
          config = readJsonClean(configFile);
        } catch {
          config = {};
        }
      }
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        config = {};
      }
      if (!config.mcpServers || typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers)) {
        config.mcpServers = {};
      }
      const existing = config.mcpServers[serverName];
      if (existing && existing.command === "node" && Array.isArray(existing.args) && existing.args.length === 1 && existing.args[0] === bundlePath) {
        return { agent, file: configFile, updated: false };
      }
      config.mcpServers[serverName] = {
        command: "node",
        args: [bundlePath]
      };
      writeJsonClean(configFile, config);
      return { agent, file: configFile, updated: true };
    }
    function registerMcpForClaude(options) {
      const res = registerMcpServersFormat({ ...options, agent: "claude" });
      return { agent: "claude", file: res.file, updated: res.updated };
    }
    function registerMcpForAntigravity(options) {
      const serverName = options.serverName || "innfo-mcp";
      const bundlePath = options.bundlePath;
      const homedir = options.homedir || os.homedir();
      if (options.configFile) {
        const res = registerMcpServersFormat({
          agent: "antigravity",
          configFile: options.configFile,
          serverName,
          bundlePath
        });
        return [{ agent: "antigravity", file: res.file, updated: res.updated }];
      }
      const geminiDir = path2.join(homedir, ".gemini");
      const candidateFiles = [
        path2.join(geminiDir, "antigravity", "mcp_config.json"),
        path2.join(geminiDir, "config", "mcp_config.json")
      ];
      const results = [];
      for (const file of candidateFiles) {
        const res = registerMcpServersFormat({
          agent: "antigravity",
          configFile: file,
          serverName,
          bundlePath
        });
        results.push({ agent: "antigravity", file: res.file, updated: res.updated });
      }
      return results;
    }
    function registerMcpAuto({ bundlePath, serverName = "innfo-mcp", homedir = os.homedir(), targetAgent = "auto" }) {
      const results = [];
      const normalizedAgent = (targetAgent || "auto").toLowerCase();
      const opencodeDir = path2.join(homedir, ".config", "opencode");
      const opencodeJson = path2.join(opencodeDir, "opencode.json");
      const opencodeJsonc = path2.join(opencodeDir, "opencode.jsonc");
      const claudeJson = path2.join(homedir, ".claude.json");
      const geminiDir = path2.join(homedir, ".gemini");
      if (normalizedAgent === "opencode") {
        const targetFile = fs.existsSync(opencodeJsonc) && !fs.existsSync(opencodeJson) ? opencodeJsonc : opencodeJson;
        results.push(registerMcpForOpenCode({ configFile: targetFile, serverName, bundlePath }));
        return results;
      }
      if (normalizedAgent === "claude") {
        results.push(registerMcpForClaude({ configFile: claudeJson, serverName, bundlePath }));
        return results;
      }
      if (normalizedAgent === "antigravity") {
        results.push(...registerMcpForAntigravity({ homedir, serverName, bundlePath }));
        return results;
      }
      if (normalizedAgent === "all") {
        const targetFile = fs.existsSync(opencodeJsonc) && !fs.existsSync(opencodeJson) ? opencodeJsonc : opencodeJson;
        results.push(registerMcpForOpenCode({ configFile: targetFile, serverName, bundlePath }));
        results.push(registerMcpForClaude({ configFile: claudeJson, serverName, bundlePath }));
        results.push(...registerMcpForAntigravity({ homedir, serverName, bundlePath }));
        return results;
      }
      let matchedAny = false;
      if (fs.existsSync(opencodeDir) || process.env.OPENCODE_SESSION_ID || process.env.OPENCODE_RUN_ID) {
        const targetFile = fs.existsSync(opencodeJsonc) && !fs.existsSync(opencodeJson) ? opencodeJsonc : opencodeJson;
        results.push(registerMcpForOpenCode({ configFile: targetFile, serverName, bundlePath }));
        matchedAny = true;
      }
      if (fs.existsSync(claudeJson) || fs.existsSync(path2.join(homedir, ".claude")) || process.env.CLAUDE_CODE || process.env.CLAUDE_PROJECT_DIR) {
        results.push(registerMcpForClaude({ configFile: claudeJson, serverName, bundlePath }));
        matchedAny = true;
      }
      if (fs.existsSync(geminiDir) || process.env.ANTIGRAVITY || process.env.GEMINI_CLI) {
        results.push(...registerMcpForAntigravity({ homedir, serverName, bundlePath }));
        matchedAny = true;
      }
      if (!matchedAny) {
        results.push(registerMcpForOpenCode({ configFile: opencodeJson, serverName, bundlePath }));
      }
      return results;
    }
    module2.exports = {
      readJsonClean,
      writeJsonClean,
      registerMcpForOpenCode,
      registerMcpForClaude,
      registerMcpForAntigravity,
      registerMcpAuto
    };
  }
});

// scripts/lib/skills-commands.js
var require_skills_commands = __commonJS({
  "scripts/lib/skills-commands.js"(exports2, module2) {
    var fs = require("fs");
    var os = require("os");
    var path2 = require("path");
    var http = require("http");
    var https = require("https");
    var { spawnSync } = require("child_process");
    var readline = require("readline");
    var {
      saveJsonAtomic,
      copyDirAtomic,
      replaceDirAtomic,
      extractTarball,
      copyDirRecursive,
      mirrorDir
    } = require_atomic_fs();
    var {
      isProjectableName,
      classifyProjection,
      hashTree
    } = require_projection();
    var {
      fetchString,
      fetchJson,
      downloadFile
    } = require_github_client();
    var {
      parseManifest
    } = require_yaml_parser();
    var { registerMcpAuto } = require_mcp_config_adapter();
    var DEFAULT_MANIFEST_URL = "https://cognnitive.com/use/manifest.md";
    var FALLBACK_MANIFEST_URL = "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/docs/use/manifest.md";
    var RETIRED_SKILL_REPOS = ["cogNNitive/cogNNitive"];
    var RETIRED_REPO_NOTICE = 'Your install points at the retired repo cogNNitive/cogNNitive (404). Back up ~/.agents/bootstrap-state.json and ~/.agents/skills/, then re-bootstrap: tell your agent "I want to use https://cognnitive.com/use". Do NOT downgrade to older public pins \u2014 they lack nn-upgrade and skills-manager.js.';
    var DEFAULT_SKILLS_DIR = path2.join(os.homedir(), ".agents", "skills");
    var DEFAULT_BLUEPRINTS_DIR = path2.join(os.homedir(), ".agents", "bluepriNNts");
    var DEFAULT_MCP_DIR = path2.join(os.homedir(), ".agents", "mcp");
    var DEFAULT_CONSOLE_DIR = path2.join(os.homedir(), ".agents", "console");
    var DEFAULT_STATE_FILE = path2.join(os.homedir(), ".agents", "bootstrap-state.json");
    var LEGACY_STATE_FILE = path2.join(os.homedir(), ".agents", "skills-state.json");
    function getManifestUrl() {
      return process.env.SM_MANIFEST_URL || DEFAULT_MANIFEST_URL;
    }
    async function fetchManifestString() {
      const primaryUrl = getManifestUrl();
      try {
        return await fetchString(primaryUrl);
      } catch (err) {
        if (!process.env.SM_MANIFEST_URL && primaryUrl !== FALLBACK_MANIFEST_URL) {
          try {
            return await fetchString(FALLBACK_MANIFEST_URL);
          } catch (fallbackErr) {
            throw new Error(`Failed to fetch manifest from ${primaryUrl} (${err.message}) and fallback ${FALLBACK_MANIFEST_URL} (${fallbackErr.message})`);
          }
        }
        throw err;
      }
    }
    function requestFor(url) {
      return url.startsWith("https:") ? https.request : http.request;
    }
    function emptyState() {
      return { manifest: getManifestUrl(), skills: {}, blueprints: {}, mcp: {}, console: {}, projections: {} };
    }
    function loadState(file) {
      if (fs.existsSync(file)) {
        try {
          const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
          const data = JSON.parse(raw);
          return {
            manifest: data.manifest || getManifestUrl(),
            skills: data.skills || {},
            blueprints: data.blueprints || {},
            mcp: data.mcp || {},
            console: data.console || {},
            projections: data.projections || {}
          };
        } catch (err) {
          return emptyState();
        }
      }
      const siblingLegacy = path2.join(path2.dirname(file), "skills-state.json");
      const legacyFileToUse = fs.existsSync(siblingLegacy) ? siblingLegacy : LEGACY_STATE_FILE;
      if (fs.existsSync(legacyFileToUse)) {
        try {
          const legacyRaw = fs.readFileSync(legacyFileToUse, "utf-8").replace(/^\uFEFF/, "");
          const legacyData = JSON.parse(legacyRaw);
          const state = {
            manifest: legacyData.manifest || getManifestUrl(),
            skills: legacyData.skills || {},
            blueprints: {},
            mcp: {},
            console: {},
            projections: {}
          };
          saveState(file, state);
          return state;
        } catch (err) {
          return emptyState();
        }
      }
      return emptyState();
    }
    function saveState(file, state) {
      saveJsonAtomic(file, state, 2);
    }
    function isRetiredPin(item) {
      return !!item && RETIRED_SKILL_REPOS.includes(item.repo);
    }
    function warnOnRetiredPins(pins) {
      if ((pins || []).some(isRetiredPin)) {
        console.log(`
NOTICE (retired repo): ${RETIRED_REPO_NOTICE}
`);
      }
    }
    function withRetiredHint(item, err) {
      if (isRetiredPin(item) && /status:\s*404|Failed to (fetch|download).*404/.test(err.message)) {
        return new Error(`${err.message}
${RETIRED_REPO_NOTICE}`);
      }
      return err;
    }
    function runTar(args, cwd) {
      return spawnSync("tar", args, { cwd, encoding: "utf-8" });
    }
    function findRepoRoot(extractDir) {
      const dirs = fs.readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      if (dirs.length !== 1) {
        throw new Error(`unexpected tarball layout: expected one root directory, found ${dirs.length}`);
      }
      return path2.join(extractDir, dirs[0]);
    }
    async function fetchCompareSummary(item, installedCommit) {
      if (!installedCommit) return "(no installed commit recorded)";
      try {
        const url = `https://api.github.com/repos/${item.repo}/compare/${installedCommit}...${item.commit}`;
        const data = await fetchJson(url);
        const prefix = item.path + "/";
        const files = (data.files || []).filter((f) => f.filename && (f.filename.startsWith(prefix) || f.filename === item.path));
        if (files.length === 0) return `0 files changed under ${item.path}`;
        const first = files.slice(0, 3).map((f) => f.filename);
        const more = files.length > 3 ? ` (+${files.length - 3} more)` : "";
        return `${files.length} files changed: ${first.join(", ")}${more}`;
      } catch (err) {
        return "(diff preview unavailable)";
      }
    }
    async function installSkillAtCommit(skill, skillsDir, state) {
      const tmpRoot = fs.mkdtempSync(path2.join(os.tmpdir(), "actioNN-skills-"));
      try {
        const tarball = path2.join(tmpRoot, "skill.tar.gz");
        const url = `https://codeload.github.com/${skill.repo}/tar.gz/${skill.commit}`;
        try {
          await downloadFile(url, tarball);
        } catch (err) {
          throw withRetiredHint(skill, err);
        }
        const extractDir = path2.join(tmpRoot, "x");
        extractTarball(tarball, extractDir);
        const repoRoot = findRepoRoot(extractDir);
        const src = path2.join(repoRoot, skill.path);
        if (!fs.existsSync(src)) {
          throw new Error(`path ${skill.path} not found in ${skill.repo} at ${skill.commit}`);
        }
        const dest = path2.join(skillsDir, skill.name);
        fs.mkdirSync(skillsDir, { recursive: true });
        if (fs.existsSync(dest)) {
          replaceDirAtomic(src, dest);
        } else {
          copyDirAtomic(src, dest);
        }
        const pkgPath = path2.join(dest, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            const deps = Object.keys(pkg.dependencies || {});
            const nodeModulesDir = path2.join(dest, "node_modules");
            const needsInstall = deps.length > 0 && (!fs.existsSync(nodeModulesDir) || deps.some((d) => !fs.existsSync(path2.join(nodeModulesDir, d))));
            if (needsInstall) {
              try {
                spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
                  cwd: dest,
                  encoding: "utf-8",
                  shell: true,
                  timeout: 6e4
                });
              } catch (_) {
              }
            }
          } catch (_) {
          }
        }
        state.skills[skill.name] = {
          commit: skill.commit,
          version: skill.version,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    }
    function installEmbeddedSkills(pkgDir, skillsDir, template, state) {
      const embeddedRoot = path2.join(pkgDir, "skills");
      if (!fs.existsSync(embeddedRoot)) return [];
      const names = [];
      try {
        for (const entry of fs.readdirSync(embeddedRoot, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const src = path2.join(embeddedRoot, entry.name);
          const skillFile = path2.join(src, "SKILL.md");
          if (!fs.existsSync(skillFile)) continue;
          const dest = path2.join(skillsDir, entry.name);
          fs.mkdirSync(skillsDir, { recursive: true });
          if (fs.existsSync(dest)) replaceDirAtomic(src, dest);
          else copyDirAtomic(src, dest);
          const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(skillFile, "utf8"));
          const versionMatch = frontmatter && /^version:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(frontmatter[1]);
          state.skills[entry.name] = {
            commit: template.commit,
            version: versionMatch ? versionMatch[1] : void 0,
            source_blueprint: template.name,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          names.push(entry.name);
        }
      } catch (err) {
        err.projectedSkills = names;
        throw err;
      }
      return names;
    }
    async function installBlueprintAtCommit(template, blueprintsDir, state, skillsDir) {
      const isMdFile = template.path.endsWith(".md") || template.path.endsWith(".markdown");
      const fileName = template.name.endsWith(".md") ? template.name : `${template.name}.md`;
      const flatDestPath = path2.join(blueprintsDir, fileName);
      const pkgDestPath = path2.join(blueprintsDir, template.name);
      fs.mkdirSync(blueprintsDir, { recursive: true });
      let recordedPath = isMdFile ? flatDestPath : pkgDestPath;
      const pkgExistedBefore = fs.existsSync(pkgDestPath);
      const tmpRoot = fs.mkdtempSync(path2.join(os.tmpdir(), "actioNN-blueprints-"));
      try {
        const tarball = path2.join(tmpRoot, "tmpl.tar.gz");
        const url = `https://codeload.github.com/${template.repo}/tar.gz/${template.commit}`;
        try {
          await downloadFile(url, tarball);
        } catch (err) {
          throw withRetiredHint(template, err);
        }
        const extractDir = path2.join(tmpRoot, "x");
        extractTarball(tarball, extractDir);
        const repoRoot = findRepoRoot(extractDir);
        const src = path2.join(repoRoot, template.path);
        if (!fs.existsSync(src)) {
          throw new Error(`template path ${template.path} not found in ${template.repo} at ${template.commit}`);
        }
        if (fs.statSync(src).isDirectory()) {
          if (fs.existsSync(pkgDestPath)) replaceDirAtomic(src, pkgDestPath);
          else copyDirAtomic(src, pkgDestPath);
          recordedPath = pkgDestPath;
        } else {
          const srcParentDir = path2.dirname(src);
          const hasPackageSubdirs = fs.existsSync(path2.join(srcParentDir, "procedures")) || fs.existsSync(path2.join(srcParentDir, "assets")) || fs.existsSync(path2.join(srcParentDir, "samples")) || path2.basename(srcParentDir).toLowerCase() === template.name.toLowerCase();
          if (hasPackageSubdirs) {
            if (fs.existsSync(pkgDestPath)) replaceDirAtomic(srcParentDir, pkgDestPath);
            else copyDirAtomic(srcParentDir, pkgDestPath);
            try {
              fs.copyFileSync(src, flatDestPath);
            } catch (_) {
            }
            recordedPath = pkgDestPath;
          } else {
            fs.copyFileSync(src, flatDestPath);
            recordedPath = flatDestPath;
          }
        }
      } catch (err) {
        if (isMdFile) {
          const rawUrl = `https://raw.githubusercontent.com/${template.repo}/${template.commit}/${template.path}`;
          await downloadFile(rawUrl, flatDestPath);
          recordedPath = flatDestPath;
        } else {
          throw err;
        }
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
      let projected = [];
      if (skillsDir && recordedPath === pkgDestPath) {
        try {
          projected = installEmbeddedSkills(pkgDestPath, skillsDir, template, state);
        } catch (err) {
          if (!pkgExistedBefore) fs.rmSync(pkgDestPath, { recursive: true, force: true });
          throw err;
        }
      }
      state.blueprints[template.name] = {
        commit: template.commit,
        version: template.version,
        path: recordedPath,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      return projected;
    }
    async function installMcpAtCommit(mcp, mcpDir, state) {
      fs.mkdirSync(mcpDir, { recursive: true });
      const bundleDest = path2.join(mcpDir, `${mcp.name}.bundle.js`);
      await downloadFile(mcp.url, bundleDest);
      if (fs.existsSync(bundleDest)) {
        const bundleContent = fs.readFileSync(bundleDest, "utf-8");
        const chunkMatches = [...bundleContent.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)].map((m) => m[1]);
        const baseUrl = mcp.url.substring(0, mcp.url.lastIndexOf("/"));
        for (const chunkFile of chunkMatches) {
          const chunkDest = path2.join(mcpDir, chunkFile);
          const chunkUrl = `${baseUrl}/${chunkFile}`;
          try {
            await downloadFile(chunkUrl, chunkDest);
          } catch (err) {
          }
        }
      }
      if (!state.mcp) state.mcp = {};
      state.mcp[mcp.name] = {
        commit: mcp.commit,
        version: mcp.version,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    async function installConsoleAssetAtCommit(asset, consoleDir, state) {
      fs.mkdirSync(consoleDir, { recursive: true });
      const fileName = path2.basename(asset.file || asset.url);
      const dest = path2.join(consoleDir, fileName);
      const url = asset.url || `https://raw.githubusercontent.com/${asset.repo}/${asset.commit}/${asset.file}`;
      await downloadFile(url, dest);
      if (!state.console) state.console = {};
      state.console[fileName] = {
        commit: asset.commit,
        version: asset.version,
        path: dest,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    function printStatusTable(rows) {
      const headers = ["Type", "Name", "Pinned", "Installed", "Status"];
      const cells = [headers, ...rows.map((r) => [r.type, r.name, r.pinned, r.installed, r.status])];
      const widths = headers.map((_, ci) => Math.max(...cells.map((r) => r[ci].length)));
      const format = (r) => r.map((c, ci) => c.padEnd(widths[ci])).join(" | ");
      console.log(format(headers));
      console.log(headers.map((_, ci) => "-".repeat(widths[ci])).join(" | "));
      for (const row of rows) console.log(format([row.type, row.name, row.pinned, row.installed, row.status]));
    }
    function promptChoice(promptText) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => {
        rl.question(promptText, (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase());
        });
      });
    }
    function isConsent(answer) {
      return ["a", "y", "yes"].includes(answer);
    }
    async function consentOrAbort(label, names, menu, yes) {
      if (names.length === 0) return false;
      if (yes) return true;
      if (!process.stdin.isTTY) {
        console.log(`needs decision: ${label}: ${names.join(", ")}`);
        process.exit(2);
      }
      console.log(menu);
      const choice = await promptChoice("> ");
      if (!isConsent(choice)) {
        console.log("Aborted. No changes applied.");
        return false;
      }
      return true;
    }
    async function cmdStatus(args) {
      const manifestRaw = await fetchManifestString();
      const { skills, blueprints, consoleAssets } = parseManifest(manifestRaw);
      warnOnRetiredPins([...skills, ...blueprints]);
      const state = loadState(args.stateFile);
      const rows = [];
      const outdatedSkills = [];
      const outdatedBlueprints = [];
      const outdatedConsoleAssets = [];
      for (const skill of skills) {
        const dirPresent = fs.existsSync(path2.join(args.skillsDir, skill.name));
        const entry = state.skills[skill.name];
        let status;
        if (dirPresent) {
          if (!entry) status = "untracked";
          else if (entry.commit === skill.commit) status = "up-to-date";
          else status = "outdated";
        } else {
          status = entry ? "dir-missing" : "missing";
        }
        rows.push({
          type: "skill",
          name: skill.name,
          pinned: skill.commit ? skill.commit.slice(0, 7) : "-",
          installed: entry ? entry.commit.slice(0, 7) : "-",
          status
        });
        if (status === "outdated") outdatedSkills.push(skill);
      }
      for (const template of blueprints) {
        const fileName = template.name.endsWith(".md") ? template.name : `${template.name}.md`;
        const pathPresent = fs.existsSync(path2.join(args.blueprintsDir, fileName)) || fs.existsSync(path2.join(args.blueprintsDir, template.name));
        const entry = state.blueprints[template.name];
        let status;
        if (pathPresent) {
          if (!entry) status = "untracked";
          else if (entry.commit === template.commit) status = "up-to-date";
          else status = "outdated";
        } else {
          status = entry ? "file-missing" : "missing";
        }
        rows.push({
          type: "template",
          name: template.name,
          pinned: template.commit ? template.commit.slice(0, 7) : "-",
          installed: entry ? entry.commit.slice(0, 7) : "-",
          status
        });
        if (status === "outdated") outdatedBlueprints.push(template);
      }
      const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
      for (const asset of consoleAssets || []) {
        const fileName = path2.basename(asset.file || asset.url);
        const pathPresent = fs.existsSync(path2.join(consoleDir, fileName));
        const entry = state.console ? state.console[fileName] : null;
        let status;
        if (pathPresent) {
          if (!entry) status = "untracked";
          else if (entry.commit === asset.commit) status = "up-to-date";
          else status = "outdated";
        } else {
          status = entry ? "file-missing" : "missing";
        }
        rows.push({
          type: "console",
          name: fileName,
          pinned: asset.commit ? asset.commit.slice(0, 7) : "-",
          installed: entry ? entry.commit.slice(0, 7) : "-",
          status
        });
        if (status === "outdated") outdatedConsoleAssets.push(asset);
      }
      printStatusTable(rows);
      if (outdatedSkills.length > 0 || outdatedBlueprints.length > 0 || outdatedConsoleAssets.length > 0) {
        console.log("\nDiff previews for outdated items:");
        for (const skill of outdatedSkills) {
          const installed = state.skills[skill.name].commit;
          console.log(`  skill ${skill.name}: ${await fetchCompareSummary(skill, installed)}`);
        }
        for (const template of outdatedBlueprints) {
          const installed = state.blueprints[template.name].commit;
          console.log(`  template ${template.name}: ${await fetchCompareSummary(template, installed)}`);
        }
      }
    }
    async function cmdInstall(args) {
      const manifestRaw = await fetchManifestString();
      const { skills, blueprints, consoleAssets } = parseManifest(manifestRaw);
      const state = loadState(args.stateFile);
      const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
      const toInstallSkills = skills.filter((skill) => !fs.existsSync(path2.join(args.skillsDir, skill.name)));
      const toInstallBlueprints = blueprints.filter((template) => {
        const fileName = template.name.endsWith(".md") ? template.name : `${template.name}.md`;
        return !fs.existsSync(path2.join(args.blueprintsDir, fileName)) && !fs.existsSync(path2.join(args.blueprintsDir, template.name));
      });
      const toInstallConsole = (consoleAssets || []).filter((asset) => {
        const fileName = path2.basename(asset.file || asset.url);
        return !fs.existsSync(path2.join(consoleDir, fileName));
      });
      if (toInstallSkills.length === 0 && toInstallBlueprints.length === 0 && toInstallConsole.length === 0) {
        console.log("All skills, templates, and console assets present.");
        return;
      }
      const names = [
        ...toInstallSkills.map((s) => `skill:${s.name}`),
        ...toInstallBlueprints.map((t) => `template:${t.name}`),
        ...toInstallConsole.map((a) => `console:${path2.basename(a.file || a.url)}`)
      ];
      const menu = `The following items are missing:
` + (toInstallSkills.length > 0 ? `Skills:
  - ${toInstallSkills.map((s) => `${s.name} (${s.version})`).join("\n  - ")}
` : "") + (toInstallBlueprints.length > 0 ? `Templates:
  - ${toInstallBlueprints.map((t) => `${t.name} (${t.version})`).join("\n  - ")}
` : "") + (toInstallConsole.length > 0 ? `Console assets:
  - ${toInstallConsole.map((a) => `${path2.basename(a.file || a.url)} (${a.version})`).join("\n  - ")}
` : "") + `
[a] Install all missing (Recommended)
[b] Skip
`;
      const proceed = await consentOrAbort("install missing skills, templates, and console assets", names, menu, args.yes);
      if (!proceed) return;
      let failures = 0;
      const embeddedSkillNames = [];
      for (const skill of toInstallSkills) {
        try {
          await installSkillAtCommit(skill, args.skillsDir, state);
          console.log(`  installed skill ${skill.name} (${skill.version}) @ ${skill.commit.slice(0, 7)}`);
        } catch (err) {
          failures++;
          console.error(`  FAIL skill ${skill.name}: ${err.message}`);
        }
      }
      for (const template of toInstallBlueprints) {
        try {
          embeddedSkillNames.push(...await installBlueprintAtCommit(template, args.blueprintsDir, state, args.skillsDir));
          console.log(`  installed template ${template.name} (${template.version}) @ ${template.commit.slice(0, 7)}`);
        } catch (err) {
          failures++;
          if (err.projectedSkills) embeddedSkillNames.push(...err.projectedSkills);
          console.error(`  FAIL template ${template.name}: ${err.message}`);
        }
      }
      for (const asset of toInstallConsole) {
        try {
          await installConsoleAssetAtCommit(asset, consoleDir, state);
          console.log(`  installed console ${path2.basename(asset.file || asset.url)} (${asset.version}) @ ${asset.commit.slice(0, 7)}`);
        } catch (err) {
          failures++;
          console.error(`  FAIL console ${path2.basename(asset.file || asset.url)}: ${err.message}`);
        }
      }
      projectSkillsToAgents({
        canonicalSkillsDir: args.skillsDir,
        targetAgent: args.agent,
        scope: args.scope,
        state,
        skillNames: [...toInstallSkills.map((s) => s.name), ...embeddedSkillNames]
      });
      saveState(args.stateFile, state);
      if (failures > 0) {
        console.error(`
${failures} item(s) failed to install.`);
        process.exit(1);
      }
      console.log(`
Installed ${toInstallSkills.length} skill(s), ${toInstallBlueprints.length} template(s), and ${toInstallConsole.length} console asset(s).`);
    }
    async function cmdUpdate(args) {
      const manifestRaw = await fetchManifestString();
      const { skills, blueprints, consoleAssets } = parseManifest(manifestRaw);
      const state = loadState(args.stateFile);
      const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
      const isOutdatedSkill = (skill) => {
        const dirPresent = fs.existsSync(path2.join(args.skillsDir, skill.name));
        const entry = state.skills[skill.name];
        return dirPresent && (!entry || entry.commit !== skill.commit);
      };
      const isOutdatedBlueprint = (template) => {
        const fileName = template.name.endsWith(".md") ? template.name : `${template.name}.md`;
        const pathPresent = fs.existsSync(path2.join(args.blueprintsDir, fileName)) || fs.existsSync(path2.join(args.blueprintsDir, template.name));
        const entry = state.blueprints[template.name];
        return pathPresent && (!entry || entry.commit !== template.commit);
      };
      const isOutdatedConsole = (asset) => {
        const fileName = path2.basename(asset.file || asset.url);
        const pathPresent = fs.existsSync(path2.join(consoleDir, fileName));
        const entry = state.console ? state.console[fileName] : null;
        return pathPresent && (!entry || entry.commit !== asset.commit);
      };
      let selectedSkills = skills.filter(isOutdatedSkill);
      let selectedBlueprints = blueprints.filter(isOutdatedBlueprint);
      let selectedConsole = (consoleAssets || []).filter(isOutdatedConsole);
      if (args.positional.length > 0) {
        selectedSkills = skills.filter((s) => args.positional.includes(s.name) && isOutdatedSkill(s));
        selectedBlueprints = blueprints.filter((t) => args.positional.includes(t.name) && isOutdatedBlueprint(t));
        selectedConsole = (consoleAssets || []).filter((a) => args.positional.includes(path2.basename(a.file || a.url)) && isOutdatedConsole(a));
      }
      if (selectedSkills.length === 0 && selectedBlueprints.length === 0 && selectedConsole.length === 0) {
        console.log("All skills, templates, and console assets up to date.");
        projectSkillsToAgents({
          canonicalSkillsDir: args.skillsDir,
          targetAgent: args.agent,
          scope: args.scope,
          state,
          skillNames: args.positional.length > 0 ? args.positional : void 0
        });
        saveState(args.stateFile, state);
        return;
      }
      const names = [
        ...selectedSkills.map((s) => `skill:${s.name}`),
        ...selectedBlueprints.map((t) => `template:${t.name}`),
        ...selectedConsole.map((a) => `console:${path2.basename(a.file || a.url)}`)
      ];
      const proceed = await consentOrAbort(
        "update skills, templates, and console assets",
        names,
        `Updating ${selectedSkills.length} skill(s), ${selectedBlueprints.length} template(s), and ${selectedConsole.length} console asset(s).

[a] Update all listed (Recommended)
[b] Skip
`,
        args.yes
      );
      if (!proceed) return;
      let failures = 0;
      const embeddedSkillNames = [];
      for (const skill of selectedSkills) {
        try {
          await installSkillAtCommit(skill, args.skillsDir, state);
          console.log(`  updated skill ${skill.name} -> ${skill.version} (${skill.commit.slice(0, 7)})`);
        } catch (err) {
          failures++;
          console.error(`  FAIL skill ${skill.name}: ${err.message}`);
        }
      }
      for (const template of selectedBlueprints) {
        try {
          embeddedSkillNames.push(...await installBlueprintAtCommit(template, args.blueprintsDir, state, args.skillsDir));
          console.log(`  updated template ${template.name} -> ${template.version} (${template.commit.slice(0, 7)})`);
        } catch (err) {
          failures++;
          if (err.projectedSkills) embeddedSkillNames.push(...err.projectedSkills);
          console.error(`  FAIL template ${template.name}: ${err.message}`);
        }
      }
      for (const asset of selectedConsole) {
        try {
          await installConsoleAssetAtCommit(asset, consoleDir, state);
          console.log(`  updated console ${path2.basename(asset.file || asset.url)} -> ${asset.version} (${asset.commit.slice(0, 7)})`);
        } catch (err) {
          failures++;
          console.error(`  FAIL console ${path2.basename(asset.file || asset.url)}: ${err.message}`);
        }
      }
      projectSkillsToAgents({
        canonicalSkillsDir: args.skillsDir,
        targetAgent: args.agent,
        scope: args.scope,
        state,
        // A positional filter names blueprint or skill entries; skills embedded in an updated blueprint have
        // their own directory names, so they must be added or they are never projected to the agents.
        skillNames: args.positional.length > 0 ? [...args.positional, ...embeddedSkillNames] : void 0
      });
      saveState(args.stateFile, state);
      if (failures > 0) {
        console.error(`
${failures} item(s) failed to update.`);
        process.exit(1);
      }
      console.log(`
Updated ${selectedSkills.length} skill(s), ${selectedBlueprints.length} template(s), and ${selectedConsole.length} console asset(s).`);
    }
    async function cmdSync(args) {
      const localSkillsDir = args.localSkillsDir || path2.resolve(__dirname, "../../skills");
      const direction = args.direction || "local-to-global";
      if (direction !== "local-to-global" && direction !== "global-to-local") {
        throw new Error(`Invalid sync direction: ${direction}. Expected local-to-global or global-to-local.`);
      }
      const srcDir = direction === "local-to-global" ? localSkillsDir : args.skillsDir;
      const destDir = direction === "local-to-global" ? args.skillsDir : localSkillsDir;
      console.log(`Sync direction: ${direction}`);
      console.log(`Source:      ${srcDir}`);
      console.log(`Destination: ${destDir}
`);
      if (!fs.existsSync(srcDir)) {
        throw new Error(`Source directory does not exist: ${srcDir}`);
      }
      const skillsToSync = fs.readdirSync(localSkillsDir).filter((name) => {
        return fs.statSync(path2.join(localSkillsDir, name)).isDirectory() && !name.startsWith(".");
      });
      const proceed = await consentOrAbort(
        "synchronize skills",
        skillsToSync,
        `This will synchronize the following skills:
${skillsToSync.map((s) => `  - ${s}`).join("\n")}

[a] Proceed with sync
[b] Skip
`,
        args.yes
      );
      if (!proceed) return;
      for (const skill of skillsToSync) {
        const srcSkill = path2.join(srcDir, skill);
        const destSkill = path2.join(destDir, skill);
        if (fs.existsSync(srcSkill)) {
          console.log(`Syncing ${skill}...`);
          copyDirRecursive(srcSkill, destSkill);
        }
      }
      console.log("\nSync completed successfully.");
    }
    async function cmdBootstrap(args) {
      const url = args.manifestUrl || getManifestUrl();
      console.log("=== cogNNitive Bootstrap ===");
      console.log(`Fetching manifest from: ${url}`);
      const manifestRaw = await fetchString(url);
      const manifest = parseManifest(manifestRaw);
      const state = loadState(args.stateFile);
      const mcpDir = args.mcpDir || DEFAULT_MCP_DIR;
      const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
      fs.mkdirSync(args.skillsDir, { recursive: true });
      fs.mkdirSync(args.blueprintsDir, { recursive: true });
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.mkdirSync(consoleDir, { recursive: true });
      const names = [
        ...manifest.skills.map((s) => `skill:${s.name}`),
        ...manifest.blueprints.map((t) => `template:${t.name}`),
        ...(manifest.consoleAssets || []).map((a) => `console:${path2.basename(a.file || a.url)}`)
      ];
      const proceed = await consentOrAbort(
        "bootstrap cogNNitive ecosystem",
        names,
        `Bootstrapping ${manifest.skills.length} skills, ${manifest.blueprints.length} templates, MCP servers, and console assets.

[a] Bootstrap now (Recommended)
[b] Cancel
`,
        args.yes
      );
      if (!proceed) return;
      console.log(`
Installing/verifying ${manifest.skills.length} skill(s)...`);
      for (const skill of manifest.skills) {
        const entry = state.skills[skill.name];
        const dirPresent = fs.existsSync(path2.join(args.skillsDir, skill.name));
        if (!dirPresent || !entry || entry.commit !== skill.commit) {
          await installSkillAtCommit(skill, args.skillsDir, state);
          console.log(`  \u2713 skill ${skill.name} (${skill.version}) @ ${skill.commit.slice(0, 7)}`);
        } else {
          console.log(`  \u2713 skill ${skill.name} (${skill.version}) up-to-date`);
        }
      }
      console.log(`
Installing/verifying ${manifest.blueprints.length} template(s)...`);
      for (const tmpl of manifest.blueprints) {
        const fileName = tmpl.name.endsWith(".md") ? tmpl.name : `${tmpl.name}.md`;
        const tmplPresent = fs.existsSync(path2.join(args.blueprintsDir, fileName)) || fs.existsSync(path2.join(args.blueprintsDir, tmpl.name));
        const entry = state.blueprints[tmpl.name];
        if (!tmplPresent || !entry || entry.commit !== tmpl.commit) {
          await installBlueprintAtCommit(tmpl, args.blueprintsDir, state, args.skillsDir);
          console.log(`  \u2713 template ${tmpl.name} (${tmpl.version}) @ ${tmpl.commit.slice(0, 7)}`);
        } else {
          console.log(`  \u2713 template ${tmpl.name} (${tmpl.version}) up-to-date`);
        }
      }
      const mcpList = [];
      for (const skill of manifest.skills) {
        if (Array.isArray(skill.mcp)) {
          mcpList.push(...skill.mcp);
        }
      }
      if (Array.isArray(manifest.mcp)) {
        mcpList.push(...manifest.mcp);
      }
      if (mcpList.length > 0) {
        console.log(`
Installing/verifying ${mcpList.length} MCP server(s)...`);
        for (const mcp of mcpList) {
          const bundleDest = path2.join(mcpDir, `${mcp.name}.bundle.js`);
          const entry = state.mcp ? state.mcp[mcp.name] : null;
          if (!fs.existsSync(bundleDest) || !entry || entry.commit !== mcp.commit) {
            await installMcpAtCommit(mcp, mcpDir, state);
            console.log(`  \u2713 bundle ${mcp.name} (${mcp.version}) @ ${mcp.commit.slice(0, 7)}`);
          } else {
            console.log(`  \u2713 bundle ${mcp.name} (${mcp.version}) up-to-date`);
          }
          const mcpRegistrations = registerMcpAuto({
            bundlePath: bundleDest,
            serverName: mcp.name,
            targetAgent: args.agent
          });
          for (const reg of mcpRegistrations) {
            console.log(`  \u2713 MCP registered for ${reg.agent}: ${reg.file} (${reg.updated ? "configured" : "already configured"})`);
          }
        }
      }
      if (manifest.consoleAssets && manifest.consoleAssets.length > 0) {
        console.log(`
Installing/verifying ${manifest.consoleAssets.length} console asset(s)...`);
        for (const asset of manifest.consoleAssets) {
          const fileName = path2.basename(asset.file || asset.url);
          const dest = path2.join(consoleDir, fileName);
          const entry = state.console ? state.console[fileName] : null;
          if (!fs.existsSync(dest) || !entry || entry.commit !== asset.commit) {
            await installConsoleAssetAtCommit(asset, consoleDir, state);
            console.log(`  \u2713 console ${fileName} (${asset.version}) @ ${asset.commit.slice(0, 7)}`);
          } else {
            console.log(`  \u2713 console ${fileName} (${asset.version}) up-to-date`);
          }
        }
      }
      projectSkillsToAgents({
        canonicalSkillsDir: args.skillsDir,
        targetAgent: args.agent,
        scope: args.scope,
        state
      });
      saveState(args.stateFile, state);
      console.log(`
Bootstrap completed successfully! All components up-to-date.`);
      if (manifest.workflows && manifest.workflows.length > 0) {
        console.log(`
Available workflows:`);
        manifest.workflows.forEach((wf, idx) => {
          console.log(`  ${idx + 1}. ${wf.label} (${wf.skill}) \u2014 ${wf.description}`);
        });
      }
    }
    function projectSkillsToAgents({
      canonicalSkillsDir,
      homedir = os.homedir(),
      targetAgent = "auto",
      silent = false,
      state = null,
      scope = "global",
      skillNames = null
    }) {
      if (scope === "workspace") {
        if (!silent) {
          console.log(`
Skipping skill projection: workspace scope does not project to global editor directories.`);
        }
        return [];
      }
      if (!fs.existsSync(canonicalSkillsDir)) return [];
      let skillEntries = [];
      try {
        const diskDirs = fs.readdirSync(canonicalSkillsDir).filter((name) => {
          return isProjectableName(name) && fs.statSync(path2.join(canonicalSkillsDir, name)).isDirectory();
        });
        if (skillNames && skillNames.length > 0) {
          skillEntries = diskDirs.filter((name) => skillNames.includes(name));
        } else if (state && state.skills && Object.keys(state.skills).length > 0) {
          skillEntries = diskDirs.filter((name) => state.skills[name]);
        } else {
          skillEntries = diskDirs;
        }
      } catch {
        return [];
      }
      if (skillEntries.length === 0) return [];
      const normalizedAgent = (targetAgent || "auto").toLowerCase();
      const projections = [];
      const agentTargets = [];
      const opencodeSkillsDir = path2.join(homedir, ".config", "opencode", "skills");
      const claudeSkillsDir = path2.join(homedir, ".claude", "skills");
      const geminiSkillsDir = path2.join(homedir, ".gemini", "config", "skills");
      if (normalizedAgent === "opencode" || normalizedAgent === "all") {
        agentTargets.push({ agent: "opencode", dir: opencodeSkillsDir });
      }
      if (normalizedAgent === "claude" || normalizedAgent === "all") {
        agentTargets.push({ agent: "claude", dir: claudeSkillsDir });
      }
      if (normalizedAgent === "antigravity" || normalizedAgent === "all") {
        agentTargets.push({ agent: "antigravity", dir: geminiSkillsDir });
      }
      if (normalizedAgent === "auto") {
        if (fs.existsSync(path2.join(homedir, ".config", "opencode")) || process.env.OPENCODE_SESSION_ID || process.env.OPENCODE_RUN_ID) {
          agentTargets.push({ agent: "opencode", dir: opencodeSkillsDir });
        }
        if (fs.existsSync(path2.join(homedir, ".claude")) || fs.existsSync(path2.join(homedir, ".claude.json")) || process.env.CLAUDE_CODE || process.env.CLAUDE_PROJECT_DIR) {
          agentTargets.push({ agent: "claude", dir: claudeSkillsDir });
        }
        if (fs.existsSync(path2.join(homedir, ".gemini")) || process.env.ANTIGRAVITY || process.env.GEMINI_CLI) {
          agentTargets.push({ agent: "antigravity", dir: geminiSkillsDir });
        }
        if (agentTargets.length === 0) {
          agentTargets.push({ agent: "opencode", dir: opencodeSkillsDir });
          agentTargets.push({ agent: "claude", dir: claudeSkillsDir });
          agentTargets.push({ agent: "antigravity", dir: geminiSkillsDir });
        }
      }
      if (state) {
        state.projections = state.projections || {};
      }
      for (const target of agentTargets) {
        fs.mkdirSync(target.dir, { recursive: true });
        if (state) {
          state.projections[target.agent] = state.projections[target.agent] || { dir: target.dir, skills: {} };
          state.projections[target.agent].dir = target.dir;
          state.projections[target.agent].skills = state.projections[target.agent].skills || {};
        }
        for (const skill of skillEntries) {
          const src = path2.join(canonicalSkillsDir, skill);
          const dest = path2.join(target.dir, skill);
          if (path2.resolve(src).toLowerCase() === path2.resolve(dest).toLowerCase()) continue;
          const classification = classifyProjection(dest, src);
          const recorded = state && state.projections[target.agent] && state.projections[target.agent].skills[skill];
          const recordState = (method) => {
            if (state) {
              state.projections[target.agent].skills[skill] = {
                method,
                source: path2.resolve(src),
                projected_at: (/* @__PURE__ */ new Date()).toISOString()
              };
            }
          };
          if (classification === "absent") {
            let method = "symlink";
            let action = "create";
            let symlinkSuccess = false;
            try {
              const symlinkType = process.platform === "win32" ? "junction" : "dir";
              fs.symlinkSync(src, dest, symlinkType);
              symlinkSuccess = true;
            } catch {
              symlinkSuccess = false;
            }
            if (!symlinkSuccess) {
              mirrorDir(src, dest, isProjectableName);
              method = /** @type {'symlink' | 'copy'} */
              "copy";
            }
            recordState(method);
            projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
          } else if (classification === "link-ok") {
            const method = "symlink";
            const action = "adopt";
            recordState(method);
            projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
          } else if (classification === "link-wrong" || classification === "link-dangling") {
            if (recorded) {
              try {
                fs.unlinkSync(dest);
              } catch {
                fs.rmSync(dest, { force: true });
              }
              let method = "symlink";
              let action = "replace";
              let symlinkSuccess = false;
              try {
                const symlinkType = process.platform === "win32" ? "junction" : "dir";
                fs.symlinkSync(src, dest, symlinkType);
                symlinkSuccess = true;
              } catch {
                symlinkSuccess = false;
              }
              if (!symlinkSuccess) {
                mirrorDir(src, dest, isProjectableName);
                method = /** @type {'symlink' | 'copy'} */
                "copy";
              }
              recordState(method);
              projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
            } else {
              projections.push({ agent: target.agent, targetDir: target.dir, skill, method: "symlink", action: "skip" });
            }
          } else if (classification === "dir") {
            if (recorded && recorded.method === "copy") {
              mirrorDir(src, dest, isProjectableName);
              recordState("copy");
              projections.push({ agent: target.agent, targetDir: target.dir, skill, method: "copy", action: "mirror" });
            } else if (!recorded) {
              const srcHash = hashTree(src, isProjectableName);
              const destHash = hashTree(dest, isProjectableName);
              if (srcHash && destHash && srcHash === destHash) {
                recordState("copy");
                projections.push({ agent: target.agent, targetDir: target.dir, skill, method: "copy", action: "adopt" });
              } else {
                projections.push({ agent: target.agent, targetDir: target.dir, skill, method: "copy", action: "skip" });
              }
            } else {
              projections.push({ agent: target.agent, targetDir: target.dir, skill, method: "copy", action: "skip" });
            }
          }
        }
      }
      if (!silent && projections.length > 0) {
        console.log(`
Projected skills to agent directories:`);
        const grouped = {};
        for (const p of projections) {
          if (!grouped[p.agent]) grouped[p.agent] = [];
          grouped[p.agent].push(p);
        }
        for (const [agent, list] of Object.entries(grouped)) {
          const active = list.filter((p) => p.action !== "skip");
          const symlinks = active.filter((p) => p.method === "symlink").length;
          const copies = active.filter((p) => p.method === "copy").length;
          const skipped = list.filter((p) => p.action === "skip").length;
          const parts = [];
          if (symlinks > 0) parts.push(`${symlinks} symlink`);
          if (copies > 0) parts.push(`${copies} copy`);
          if (active.length > 0) {
            console.log(`  \u2713 ${agent}: ${active.length} skill(s) synchronized (${parts.join(", ")})`);
          }
          if (skipped > 0) {
            console.log(`  \u26A0\uFE0F ${agent}: ${skipped} unmanaged skill(s) skipped`);
          }
        }
      }
      return projections;
    }
    module2.exports = {
      get MANIFEST_URL() {
        return getManifestUrl();
      },
      DEFAULT_MANIFEST_URL,
      FALLBACK_MANIFEST_URL,
      DEFAULT_SKILLS_DIR,
      DEFAULT_BLUEPRINTS_DIR,
      DEFAULT_MCP_DIR,
      DEFAULT_CONSOLE_DIR,
      DEFAULT_STATE_FILE,
      LEGACY_STATE_FILE,
      getManifestUrl,
      requestFor,
      fetchString,
      fetchJson,
      downloadFile,
      parseManifest,
      emptyState,
      loadState,
      saveState,
      runTar,
      extractTarball,
      findRepoRoot,
      copyDirAtomic,
      replaceDirAtomic,
      copyDirRecursive,
      fetchCompareSummary,
      installSkillAtCommit,
      installBlueprintAtCommit,
      installEmbeddedSkills,
      installMcpAtCommit,
      installConsoleAssetAtCommit,
      projectSkillsToAgents,
      printStatusTable,
      promptChoice,
      isConsent,
      consentOrAbort,
      cmdStatus,
      cmdInstall,
      cmdUpdate,
      cmdSync,
      cmdBootstrap,
      RETIRED_SKILL_REPOS,
      RETIRED_REPO_NOTICE,
      isRetiredPin,
      withRetiredHint
    };
  }
});

// scripts/skills-manager.js
var path = require("path");
var commands = require_skills_commands();
function parseArgs(argv) {
  const args = {
    positional: [],
    skillsDir: null,
    blueprintsDir: null,
    mcpDir: null,
    consoleDir: null,
    state: null,
    stateFile: null,
    yes: false,
    direction: "local-to-global",
    agent: "auto",
    scope: "global"
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--yes" || arg === "-y") {
      args.yes = true;
    } else if (arg === "--direction") {
      const value = argv[i + 1];
      if (value === void 0 || value.startsWith("--")) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.direction = value;
      i++;
    } else if (arg === "--agent") {
      const value = argv[i + 1];
      if (value === void 0 || value.startsWith("--")) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.agent = value;
      i++;
    } else if (arg === "--scope") {
      const value = argv[i + 1];
      if (value === void 0 || value.startsWith("--")) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.scope = value;
      i++;
    } else if (arg === "--skills-dir" || arg === "--templates-dir" || arg === "--mcp-dir" || arg === "--console-dir" || arg === "--state") {
      const value = argv[i + 1];
      if (value === void 0 || value.startsWith("--")) {
        throw new Error(`Option ${arg} requires a value`);
      }
      if (arg === "--skills-dir") args.skillsDir = value;
      else if (arg === "--templates-dir") args.blueprintsDir = value;
      else if (arg === "--mcp-dir") args.mcpDir = value;
      else if (arg === "--console-dir") args.consoleDir = value;
      else args.state = value;
      i++;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args.positional.push(arg);
    }
  }
  return args;
}
function usage() {
  console.log(`Usage:
  node scripts/skills-manager.js bootstrap [--scope <global|workspace>] [--agent <auto|opencode|claude|antigravity>] [--yes]
  node scripts/skills-manager.js status    [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>]
  node scripts/skills-manager.js install   [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>] [--yes]
  node scripts/skills-manager.js update    [item ...] [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>] [--yes]
  node scripts/skills-manager.js sync      [--skills-dir <dir>] [--templates-dir <dir>] [--direction <local-to-global|global-to-local>] [--yes]

Commands:
  bootstrap Full zero-touch ecosystem setup: skills, templates, MCP bundles, and agent registration.
  status    Compare installed commits (state file) against manifest pins.
  install   Install missing skills and templates at their pinned commit.
  update    Update outdated skills and templates at their pinned commit.
  sync      Synchronize skill and template files between local repository and global agent directory.

Flags:
  --scope <scope>        Installation scope: global (default, ~/.agents/) or workspace (./.agents/)
  --agent <agent>        Target agent for MCP/Skills: auto (default), all, opencode, claude, antigravity
  --skills-dir <dir>     Skills directory (default: ~/.agents/skills)
  --templates-dir <dir>  Templates directory (default: ~/.agents/templates)
  --mcp-dir <dir>        MCP bundle directory (default: ~/.agents/mcp)
  --console-dir <dir>    Console bundle directory (default: ~/.agents/console)
  --state <file>         State file (default: ~/.agents/bootstrap-state.json)
  --direction <dir>      Sync direction: local-to-global (default) or global-to-local
  --yes, -y              Skip the interactive consent prompt.

Consent is mandatory. Without a TTY and without --yes, the script prints
"needs decision: ..." and exits 2 without applying anything.`);
}
async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`skills-manager: ${err.message}`);
    process.exit(1);
  }
  const command = args.positional.shift();
  if (!command || !["bootstrap", "status", "install", "update", "sync"].includes(command)) {
    usage();
    process.exit(1);
  }
  const isWorkspaceScope = args.scope === "workspace";
  const defaultSkills = isWorkspaceScope ? "./.agents/skills" : commands.DEFAULT_SKILLS_DIR;
  const defaultBlueprints = isWorkspaceScope ? "./specs/bluepriNNts" : commands.DEFAULT_BLUEPRINTS_DIR;
  const defaultMcp = isWorkspaceScope ? "./.agents/mcp" : commands.DEFAULT_MCP_DIR;
  const defaultConsole = isWorkspaceScope ? "./.agents/console" : commands.DEFAULT_CONSOLE_DIR;
  const defaultState = isWorkspaceScope ? "./.agents/bootstrap-state.json" : commands.DEFAULT_STATE_FILE;
  const resolvedArgs = {
    positional: args.positional,
    skillsDir: path.resolve(args.skillsDir || defaultSkills),
    blueprintsDir: path.resolve(args.blueprintsDir || defaultBlueprints),
    mcpDir: path.resolve(args.mcpDir || defaultMcp),
    consoleDir: path.resolve(args.consoleDir || defaultConsole),
    stateFile: path.resolve(args.state || defaultState),
    yes: args.yes,
    direction: args.direction,
    agent: args.agent,
    scope: args.scope
  };
  try {
    if (command === "bootstrap") await commands.cmdBootstrap(resolvedArgs);
    else if (command === "status") await commands.cmdStatus(resolvedArgs);
    else if (command === "install") await commands.cmdInstall(resolvedArgs);
    else if (command === "update") await commands.cmdUpdate(resolvedArgs);
    else await commands.cmdSync(resolvedArgs);
  } catch (err) {
    console.error(`skills-manager: ${err.message}`);
    process.exit(1);
  }
}
module.exports = Object.defineProperties({
  ...commands,
  parseArgs,
  usage,
  main
}, {
  MANIFEST_URL: {
    get() {
      return commands.getManifestUrl();
    },
    enumerable: true
  }
});
if (require.main === module) {
  main();
}
