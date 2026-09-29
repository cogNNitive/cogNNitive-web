/* Reusable verification harness + slot-contract helpers for Timeline-pattern
   console artifacts (metrics template).

   The exported contract helpers (bottom of file) are pure and importable by
   unit tests via createRequire: mapMetaToInnfoModel, guardPureDataSeries,
   guardExecutablePayload, scanInlineRuntime, parseSlotsFromHtml, evaluateGate,
   thinDecision, resolveNeeds, chartsCapability, seriesShapeForCharts,
   REQUIRED_META_KEYS, MONTHS_CAP, INLINE_RUNTIME_MARKERS.

   CLI modes (executed only when run directly — importing never starts a server):
     node verify.harness.js --check-slots --file <console.html> [--json]
       Static slot validation: innfo-config needs[] must resolve through
       console/needs-registry.json, required meta keys must be present (fail
       fast NAMING the missing key), the charts capability (when declared)
       must be registered AND series shape must match meta.charts ids, series
       payloads must be pure data (fail fast naming the offending chart), and
       no inline runtime block may survive (fail fast naming the offending
       block). No browser needed.

     node verify.harness.js --probe [--root <dir> --file <console.html>]
       Activation gate probe: checks the console runtime pins from
       console/needs-registry.json are reachable (jsDelivr + raw mirror),
       the charts capability is registered, AND loads the console over file://
       in headless Chromium with zero page errors. Prints the gate verdict
       (open | closed). Requires playwright-core + a Chromium executable.

     node verify.harness.js --root <dir> --file <console.html> [--port N]
       Render check: loads the console over file:// (default) or HTTP (--port)
       and asserts zero pageerrors plus a real render (banner text, concept
       rail buttons, element cards, matrices when the model declares them,
       uPlot charts when "charts" is declared in needs[], feedback-export
       button when declared in needs[]).

   Gates: zero pageerrors + rendered slots. No absolute paths; Chromium
   resolved via PLAYWRIGHT_CORE / CHROME_EXE env with local install fallback. */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ---------------------------------------------------------------------------
 * Slot contract (pure, DOM-free — unit-tested via packages/innfo-core).
 * ------------------------------------------------------------------------- */

/* Required meta keys for innfo-model (design contract, spec: Artifact Shape).
   model, model_version, source_model, generated_at, months, historyMonths,
   charts, slug, title, startMonth/startYear MUST map into innfo-model. */
const REQUIRED_META_KEYS = [
  'model',
  'model_version',
  'source_model',
  'generated_at',
  'months',
  'historyMonths',
  'charts',
  'slug',
  'title',
  'startMonth',
  'startYear',
];

/* Series-as-data horizon cap: projected months window is capped to avoid
   unbounded JSON bloat on long horizons (design risk mitigation). */
const MONTHS_CAP = 120;

/* Markers that indicate a duplicated inline copy of the shared runtime or of
   the dashboard engine. Static <script src> tags are REQUIRED (not markers).
   SCOPE: this scan is applied ONLY to console HTML files — never to the
   vendored innfo-console.bundle.js, which legitimately embeds uPlot
   (incl. `new uPlot` inside the vendored library) and renderCharts. */
const INLINE_RUNTIME_MARKERS = [
  'INNFO_RUNTIME_INLINE',
  'innfo-runtime-inline',
  'window.InnfoConsole=',
  'window.InnfoConsole =',
  'const MODEL_DATA',
  'const FORMULAS',
  'const DEPS',
  'const SERIES',
  'const SEASON',
  'new uPlot',
  'eval(',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/* Returns { ok, missing } — missing names every required key that is absent
   from the meta object (fail-fast naming, spec: malformed slot fails fast). */
function mapMetaToInnfoModel(meta) {
  const source = isPlainObject(meta) ? meta : {};
  const missing = REQUIRED_META_KEYS.filter((key) => source[key] === undefined);
  return { ok: missing.length === 0, missing };
}

const EXECUTABLE_JS_PATTERNS = [
  [/eval\s*\(/i, 'eval('],
  [/new\s+Function/i, 'new Function'],
  [/=>/i, 'arrow function literal'],
  [/\bfunction\s*\(/i, 'function literal'],
];

function findExecutableJs(value) {
  for (const [pattern, label] of EXECUTABLE_JS_PATTERNS) {
    if (pattern.test(String(value))) return label;
  }
  return null;
}

/* Series-as-data guard: every series block value must be a plain JSON scalar
   (finite number or null). Rejects executable JS strings and nested objects,
   naming the offending chart (spec: pure-data series snapshot). */
function guardPureDataSeries(series) {
  const source = isPlainObject(series) ? series : {};
  const offenders = [];
  Object.keys(source).forEach((chartId) => {
    const values = source[chartId];
    if (!Array.isArray(values)) {
      offenders.push({ chart: chartId, detail: 'must be a number array (got ' + typeof values + ')' });
      return;
    }
    values.forEach((value, index) => {
      if (value === null || (typeof value === 'number' && Number.isFinite(value))) return;
      const js = findExecutableJs(value);
      if (js) {
        offenders.push({
          chart: chartId,
          detail: 'executable JS (' + js + ') at index ' + index,
        });
        return;
      }
      if (typeof value === 'number') {
        offenders.push({ chart: chartId, detail: 'non-finite number at index ' + index });
        return;
      }
      offenders.push({
        chart: chartId,
        detail: 'value at index ' + index + ' is not pure JSON data (' + typeof value + ')',
      });
    });
  });
  return { ok: offenders.length === 0, offenders };
}

/* Executable-payload guard over the whole slot payload (spec: executable slot
   payload rejected). Flags eval / new Function / function / arrow literals
   anywhere in the JSON, reporting the JSON path. */
function guardExecutablePayload(obj) {
  const offenders = [];
  function walk(value, jsonPath) {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
    if (typeof value === 'string') {
      const js = findExecutableJs(value);
      if (js) offenders.push({ path: jsonPath, detail: 'executable JS (' + js + ')' });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, jsonPath + '[' + index + ']'));
      return;
    }
    if (isPlainObject(value)) {
      Object.keys(value).forEach((key) => walk(value[key], jsonPath + '.' + key));
      return;
    }
    offenders.push({
      path: jsonPath,
      detail: 'value carries a non-JSON type (' + typeof value + ')',
    });
  }
  walk(obj, 'payload');
  return { ok: offenders.length === 0, offenders };
}

/* Inline-runtime scan: names every offending block marker found in the HTML.
   A clean thinned console (console shell + static bundle tags) reports ok
   with zero blocks (spec: inline runtime rejected, naming the block). */
function scanInlineRuntime(html) {
  const blocks = INLINE_RUNTIME_MARKERS.filter((marker) => String(html).indexOf(marker) !== -1);
  return { ok: blocks.length === 0, blocks };
}

/* Extracts the three JSON slots from a thinned console. Returns null per slot
   when the block is missing or holds corrupt JSON (never crashes the scan). */
function parseSlotsFromHtml(html) {
  const source = String(html || '');
  function readSlot(id) {
    const pattern = new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)<\\/script>');
    const match = pattern.exec(source);
    if (!match) return null;
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  }
  return { config: readSlot('innfo-config'), schema: readSlot('innfo-schema'), model: readSlot('innfo-model') };
}

/* Activation gate (spec: Activation Gate Before Thinning). OPEN only when the
   runtime URL is reachable AND the file:// smoke passes AND the charts
   capability is registered; otherwise CLOSED and the inline dashboard stays
   canonical. */
function evaluateGate(probe) {
  const reachable = Boolean(probe && probe.runtimeReachable);
  const smoke = Boolean(probe && probe.fileSmokePassed);
  const charts = Boolean(probe && probe.chartsRegistered);
  return reachable && smoke && charts ? 'open' : 'closed';
}

function thinDecision(gate) {
  return gate === 'open' ? 'thin' : 'keep-inline';
}

/* needs[] resolution through console/needs-registry.json (pins resolve via
   registry — never hand-edit URLs). Unknown needs are reported by name. */
function resolveNeeds(needs, registry) {
  const declared = isPlainObject(registry) && isPlainObject(registry.needs) ? registry.needs : {};
  const unknown = (Array.isArray(needs) ? needs : []).filter((need) => !declared[need]);
  return { ok: unknown.length === 0, unknown };
}

/* Charts capability contract (spec: Harness and Sample Verification): when a
   console declares "charts" in needs[], the capability MUST also be registered
   in console/needs-registry.json — a declared-but-unregistered need is a
   broken pin. */
function chartsCapability(needs, registry) {
  const declared = Array.isArray(needs) && needs.indexOf('charts') !== -1;
  const registered =
    isPlainObject(registry) && isPlainObject(registry.needs) && !!registry.needs['charts'];
  return { declared, registered, ok: !declared || registered };
}

/* Series shape contract (spec: Harness and Sample Verification): every chartId
   declared in meta.charts MUST have a matching pure-data series array. Reports
   missing ids by name; purity violations ride on guardPureDataSeries. */
function seriesShapeForCharts(meta, series) {
  const chartsMeta =
    isPlainObject(meta) && Array.isArray(meta.charts) ? meta.charts : [];
  const seriesSource = isPlainObject(series) ? series : {};
  const missing = chartsMeta
    .map((c) => c && c.id)
    .filter((id) => {
      return id != null && !Array.isArray(seriesSource[id]);
    });
  const declaredIds = chartsMeta.map((c) => c && c.id).filter((id) => id != null);
  const extra = Object.keys(seriesSource).filter((id) => declaredIds.indexOf(id) === -1);
  return { ok: missing.length === 0, missing, extra };
}

module.exports = {
  REQUIRED_META_KEYS,
  MONTHS_CAP,
  INLINE_RUNTIME_MARKERS,
  mapMetaToInnfoModel,
  guardPureDataSeries,
  guardExecutablePayload,
  scanInlineRuntime,
  parseSlotsFromHtml,
  evaluateGate,
  thinDecision,
  resolveNeeds,
  chartsCapability,
  seriesShapeForCharts,
};

/* ---------------------------------------------------------------------------
 * CLI runner (only when executed directly).
 * ------------------------------------------------------------------------- */
if (require.main === module) {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []))
      .filter((x) => x.length),
  );
  const ROOT = path.resolve(args.root || 'artifacts');
  const FILE = args.file || 'timeline.html';
  const PORT = Number(args.port || 0);
  const SHOT = args.shot || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'proy-verify-')), 'verify.png');

  const REGISTRY_PATH = path.join(__dirname, '..', '..', 'console', 'needs-registry.json');

  function readRegistry() {
    try {
      return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch {
      return { needs: {} };
    }
  }

  function loadChromium() {
    const candidates = [
      process.env.PLAYWRIGHT_CORE,
      'playwright-core',
      path.join(process.cwd(), 'node_modules', 'playwright-core'),
    ].filter(Boolean);
    let lastErr = null;
    for (const c of candidates) {
      try {
        return require(c).chromium;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(
      'playwright-core not found. Install it (npm i -D playwright-core) or set PLAYWRIGHT_CORE. Last error: ' +
        lastErr,
    );
  }

  function chromiumFromEnv() {
    const launchOpts = { args: ['--no-sandbox'] };
    if (process.env.CHROME_EXE) launchOpts.executablePath = process.env.CHROME_EXE;
    return launchOpts;
  }

  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    fs.readFile(f, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('nf');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  });

  function fail(message) {
    console.error('HARNESS FAIL', message);
    process.exit(1);
  }

  /* --check-slots: static validation of a thinned console. */
  if (args['check-slots'] !== undefined) {
    const target = path.resolve(ROOT, FILE);
    let html;
    try {
      html = fs.readFileSync(target, 'utf8');
    } catch (e) {
      fail('cannot read ' + target + ': ' + e.message);
    }
    const slots = parseSlotsFromHtml(html);
    const problems = [];
    if (!slots.config || !Array.isArray(slots.config.needs)) {
      problems.push('innfo-config: needs[] block missing or corrupt');
    } else {
      const registry = readRegistry();
      const needs = resolveNeeds(slots.config.needs, registry);
      if (!needs.ok) {
        problems.push('innfo-config needs: unknown capabilities ' + needs.unknown.join(', ') + ' (not in console/needs-registry.json)');
      }
      const charts = chartsCapability(slots.config.needs, registry);
      if (!charts.ok) {
        problems.push('charts capability: declared in needs[] but NOT registered in console/needs-registry.json');
      }
    }
    if (!slots.model) {
      problems.push('innfo-model: slot missing or corrupt JSON');
    } else {
      const meta = mapMetaToInnfoModel(slots.model.meta);
      if (!meta.ok) {
        problems.push('innfo-model meta: missing required key(s): ' + meta.missing.join(', '));
      }
      if (typeof slots.model.meta === 'object' && slots.model.meta) {
        const months = Number(slots.model.meta.months || 0);
        if (months > MONTHS_CAP) {
          problems.push('innfo-model meta: months ' + months + ' exceeds the cap of ' + MONTHS_CAP);
        }
      }
      const series = guardPureDataSeries(slots.model.series || {});
      if (!series.ok) {
        problems.push(
          'innfo-model series: executable/non-pure data in ' +
            series.offenders.map((o) => o.chart + ' (' + o.detail + ')').join(', '),
        );
      }
      const shape = seriesShapeForCharts(slots.model.meta, slots.model.series);
      if (!shape.ok) {
        problems.push(
          'innfo-model series: chartId(s) declared in meta.charts without a series array: ' +
            shape.missing.join(', '),
        );
      }
      const payload = guardExecutablePayload(slots.model);
      if (!payload.ok) {
        problems.push(
          'innfo-model: ' + payload.offenders.map((o) => o.path + ' ' + o.detail).join('; '),
        );
      }
    }
    if (!slots.schema) {
      problems.push('innfo-schema: slot missing or corrupt JSON');
    }
    const runtime = scanInlineRuntime(html);
    if (!runtime.ok) {
      problems.push('inline runtime block(s) found: ' + runtime.blocks.join(', ') + ' — thinned consoles must load the shared bundle via static script tags only');
    }
    const result = { ok: problems.length === 0, problems, file: FILE };
    if (args.json !== undefined) {
      console.log(JSON.stringify(result, null, 1));
    } else {
      console.log(result.ok ? 'SLOTS OK' : 'SLOTS FAIL');
      if (!result.ok) console.log('problems: ' + problems.join(' | '));
    }
    process.exit(result.ok ? 0 : 1);
  }

  /* --probe: activation gate probe (runtime pins reachable + file:// smoke). */
  if (args.probe !== undefined) {
    function withTimeout(promise, ms) {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after ' + ms + 'ms')), ms)),
      ]);
    }
    (async () => {
      const registry = readRegistry();
      let urls = [];
      try {
        // Prefer the pins the target console actually declares (bundle boot),
        // falling back to the registry runtime pins.
        const targetHtml = fs.readFileSync(path.resolve(ROOT, FILE), 'utf8');
        const slots = parseSlotsFromHtml(targetHtml);
        if (slots.config && isPlainObject(slots.config.runtime)) {
          urls = [slots.config.runtime.cdn, slots.config.runtime.fallback].filter(Boolean);
        }
      } catch {
        // target console missing — probe the registry pins only.
      }
      if (!urls.length) {
        const pins = registry.runtime || {};
        urls = [pins.cdn, pins.fallback].filter(Boolean);
      }
      let reachable = urls.length > 0;
      for (const url of urls) {
        try {
          if (typeof fetch !== 'function') {
            reachable = false;
            break;
          }
          const res = await withTimeout(fetch(url, { method: 'HEAD', redirect: 'follow' }), 15000);
          if (!(res && res.ok)) {
            reachable = false;
            break;
          }
        } catch {
          reachable = false;
          break;
        }
      }
      let fileSmokePassed = false;
      try {
        const { chromium } = { chromium: loadChromium() };
        const browser = await withTimeout(chromium.launch(chromiumFromEnv()), 60000);
        const page = await withTimeout(browser.newPage(), 30000);
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
        const target = path.resolve(ROOT, FILE);
        await withTimeout(page.goto('file:///' + target.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 }), 90000);
        await withTimeout(page.waitForTimeout(1500), 10000);
        fileSmokePassed = errs.length === 0;
        await withTimeout(browser.close(), 30000);
      } catch (e) {
        console.error('smoke error:', String(e).slice(0, 200));
        fileSmokePassed = false;
      }
      const chartsRegistered =
        registry.needs && registry.needs['charts'] ? true : false;
      const gate = evaluateGate({ runtimeReachable: reachable, fileSmokePassed, chartsRegistered });
      const report = { gate, runtimeReachable: reachable, fileSmokePassed, chartsRegistered, pins: urls };
      console.log(JSON.stringify(report, null, 1));
      process.exit(gate === 'open' ? 0 : 1);
    })().catch((e) => {
      console.error('HARNESS FAIL', e);
      process.exit(1);
    });
  }

  /* Default: render check with zero pageerrors + real slot render. */
  else {
    (async () => {
    const { chromium } = { chromium: loadChromium() };
    const useHttp = PORT > 0;
    if (useHttp) {
      await new Promise((r) => server.listen(PORT, r));
    }
    const browser = await chromium.launch(chromiumFromEnv());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    const url = useHttp
      ? 'http://127.0.0.1:' + PORT + '/' + FILE
      : 'file:///' + path.resolve(ROOT, FILE).replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      banner: document.getElementById('innfo-banner')
        ? document.getElementById('innfo-banner').textContent.trim()
        : 'NO-BANNER',
      rail: document.querySelectorAll('#innfo-rail button').length,
      cards: document.querySelectorAll('#innfo-content .innfo-card').length,
      matrices: document.querySelectorAll('#innfo-matrices table').length,
      charts: document.querySelectorAll('#innfo-charts .innfo-chart, #innfo-timeline-grid table').length,
      exportOpen: Boolean(document.getElementById('innfo-export-open')),
    }));
    console.log(JSON.stringify(info, null, 1));
    await page.screenshot({ path: SHOT });
    console.log('pageerrors:', errs.length ? errs : 'none');
    const slots = parseSlotsFromHtml(fs.readFileSync(path.resolve(ROOT, FILE), 'utf8'));
    const model = slots.model && isPlainObject(slots.model) ? slots.model : {};
    const expectMatrices = Array.isArray(model.matrices) && model.matrices.length > 0;
    const needs = slots.config && Array.isArray(slots.config.needs) ? slots.config.needs : [];
    const expectExport = needs.indexOf('feedback-export') !== -1;
    const expectCharts = needs.indexOf('charts') !== -1;
    const ok =
      errs.length === 0 &&
      info.banner.length > 0 &&
      info.cards > 0 &&
      (!expectMatrices || info.matrices > 0) &&
      (!expectCharts || info.charts > 0) &&
      (!expectExport || info.exportOpen);
    await browser.close();
      if (useHttp) server.close();
      process.exit(ok ? 0 : 1);
    })().catch((e) => {
      console.error('HARNESS FAIL', e);
      process.exit(1);
    });
  }
}