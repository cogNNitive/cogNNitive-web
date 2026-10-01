const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Strips leading frontmatter delimited by ---.
 * @param {string} content
 * @returns {string}
 */
function stripFrontmatter(content) {
  if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) return content.slice(endIdx + 5);
  }
  return content;
}

/**
 * Zero-dependency HTML-to-Markdown conversion.
 * Preserves headings, bold/italics, links, lists, code, and tables.
 * @param {string} html
 * @returns {string}
 */
function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n')
    // Bold / Italic / Code
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // Links
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1')
    .replace(/<\/(ul|ol)>/gi, '\n\n')
    // Paragraphs & breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|tr|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    // Entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    // Cleanup whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse an RFC-4180-subset CSV over the WHOLE document: comma delimiter, `"`
 * quoting with `""` escape, CRLF/LF row breaks, and newlines preserved verbatim
 * inside quoted fields. CR-only is data; a trailing newline yields no extra row.
 *
 * Mirrors the canonical `parseCsvTable` (iNNfo/packages/innfo-core/src/csvTable.ts).
 * Kept inline because the distributed skill ships zero innfo-core dependency.
 *
 * @param {string} content
 * @returns {{ rows: string[][], malformed: boolean }} malformed=true on unbalanced quotes.
 */
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let hasContent = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // Skip the trailing empty line the final newline would otherwise produce.
    if (row.length === 1 && row[0] === '' && !hasContent) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
    hasContent = false;
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    hasContent = hasContent || (ch !== '\r' && ch !== '\n') || inQuotes;
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\r') {
      // Lone CR is data; CRLF breaks the row via the LF branch.
      if (content[i + 1] !== '\n') field += ch;
    } else if (ch === '\n') {
      pushField();
      pushRow();
    } else {
      field += ch;
    }
  }
  if (inQuotes) return { rows: [], malformed: true };
  pushField();
  pushRow();
  return { rows, malformed: false };
}

/**
 * Converts CSV content into a Data Dictionary + Statistical Profile and sample rows.
 * @param {string} content
 * @param {string} baseName
 * @returns {string}
 */
function convertCsv(content, baseName) {
  const { rows: parsedRows, malformed } = parseCsv(content);
  if (malformed) {
    return `# NN Dataset Schema: ${baseName}\n\n*Malformed CSV: unbalanced quotes — no rows parsed.*\n`;
  }

  const trimmed = parsedRows.map(r => r.map(cell => cell.trim()));
  // Drop blank lines; the first surviving record is the header row.
  const records = trimmed.filter(r => r.some(cell => cell !== ''));
  if (records.length === 0) {
    return `# NN Dataset Schema: ${baseName}\n\n*Empty CSV dataset*\n`;
  }

  const headers = records[0];
  const rows = records
    .slice(1)
    .filter(r => r.length === headers.length || r.some(cell => cell !== ''));

  // Column profiling
  const colStats = headers.map((header, colIdx) => {
    let nullCount = 0;
    let numericCount = 0;
    let numMin = Infinity;
    let numMax = -Infinity;
    let numSum = 0;
    let dateCount = 0;

    for (const row of rows) {
      const val = row[colIdx];
      if (val === undefined || val === '' || val === null) {
        nullCount++;
        continue;
      }
      const num = Number(val);
      if (!isNaN(num) && val.trim() !== '') {
        numericCount++;
        numSum += num;
        if (num < numMin) numMin = num;
        if (num > numMax) numMax = num;
      } else if (!isNaN(Date.parse(val)) && val.length >= 8) {
        dateCount++;
      }
    }

    const nonNullCount = rows.length - nullCount;
    let inferredType = 'string';
    let summaryMetrics = '-';

    if (nonNullCount > 0 && numericCount / nonNullCount > 0.8) {
      inferredType = Number.isInteger(numMin) && Number.isInteger(numMax) ? 'integer' : 'float';
      const avg = (numSum / numericCount).toFixed(2);
      summaryMetrics = `min: ${numMin}, max: ${numMax}, avg: ${avg}`;
    } else if (nonNullCount > 0 && dateCount / nonNullCount > 0.8) {
      inferredType = 'date';
    }

    return {
      header: header || `Col_${colIdx + 1}`,
      inferredType,
      nullCount,
      summaryMetrics,
    };
  });

  let out = `# NN Dataset Schema: ${baseName}\n\n`;
  out += '| Column | Inferred Type | Null Count | Summary Metrics |\n';
  out += '|---|---|---|---|\n';
  for (const col of colStats) {
    out += `| ${col.header} | ${col.inferredType} | ${col.nullCount} | ${col.summaryMetrics} |\n`;
  }

  out += `\n## NN Summary Statistics\n\n`;
  out += `- **Total Rows**: ${rows.length.toLocaleString()}\n`;
  out += `- **Total Columns**: ${headers.length}\n`;
  out += `- **Columns**: ${headers.join(', ')}\n\n`;

  const sampleLimit = Math.min(rows.length, 15);
  out += `## NN Sample Data (First ${sampleLimit} Rows)\n\n`;
  out += `| ${headers.join(' | ')} |\n`;
  out += `| ${headers.map(() => '---').join(' | ')} |\n`;
  for (let i = 0; i < sampleLimit; i++) {
    const row = rows[i];
    const cells = headers.map((_, idx) => (
      row[idx] !== undefined
        // Escape the pipe and flatten embedded newlines so one cell cannot
        // break the markdown table into a phantom row.
        ? row[idx].replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
        : ''
    ));
    out += `| ${cells.join(' | ')} |\n`;
  }

  return out;
}

/**
 * Converts SRT / WebVTT subtitle streams into continuous coherent paragraphs.
 * @param {string} content
 * @param {string} baseName
 * @returns {string}
 */
function convertSubtitles(content, baseName) {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const cues = [];
  let currentCue = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentCue && currentCue.text.length > 0) {
        cues.push(currentCue);
        currentCue = null;
      }
      continue;
    }
    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (timeMatch) {
      if (currentCue && currentCue.text.length > 0) {
        cues.push(currentCue);
      }
      currentCue = {
        start: timeMatch[1].replace(',', '.'),
        end: timeMatch[2].replace(',', '.'),
        text: []
      };
      continue;
    }
    if (/^\d+$/.test(line) || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }
    if (currentCue) {
      const cleanLine = line.replace(/<[^>]+>/g, '').trim();
      if (cleanLine) currentCue.text.push(cleanLine);
    }
  }
  if (currentCue && currentCue.text.length > 0) {
    cues.push(currentCue);
  }

  if (cues.length === 0) {
    return `# ${baseName}\n\n${content}\n`;
  }

  let out = `# ${baseName}\n\n`;
  let currentSectionTime = cues[0].start.split('.')[0];
  let sectionParagraphs = [];
  let currentParagraph = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const cueText = cue.text.join(' ');

    if (i > 0 && i % 15 === 0) {
      if (currentParagraph.length > 0) {
        sectionParagraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
      out += `## NN Section: [${currentSectionTime}]\n\n`;
      out += sectionParagraphs.join('\n\n') + '\n\n';
      sectionParagraphs = [];
      currentSectionTime = cue.start.split('.')[0];
    }

    if (/^[A-Z][a-zA-Z\s]{1,25}:/.test(cueText) && currentParagraph.length > 0) {
      sectionParagraphs.push(currentParagraph.join(' '));
      currentParagraph = [cueText];
    } else {
      currentParagraph.push(cueText);
    }
  }

  if (currentParagraph.length > 0) {
    sectionParagraphs.push(currentParagraph.join(' '));
  }
  if (sectionParagraphs.length > 0) {
    out += `## NN Section: [${currentSectionTime}]\n\n`;
    out += sectionParagraphs.join('\n\n') + '\n';
  }

  return out.trim() + '\n';
}

/**
 * Detects reviewer-feedback JSON by its canonical drop zone
 * (sources/import/feedback/ with legacy sources/original/feedback/ support).
 * @param {string} filePath
 * @returns {boolean}
 */
function isFeedbackJsonPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return /(^|\/)(import|original)\/feedback\//.test(normalized);
}

const FEEDBACK_ITEM_KINDS = ['correction', 'comment', 'new', 'delete'];
const FORBIDDEN_FEEDBACK_META_KEYS = [
  'knowledge',
  'knowledge_version',
  'session_label',
  'source_model',
  'source_model_version',
];
const FORBIDDEN_FEEDBACK_ITEM_KEYS = [
  'status',
  'layer',
  'severity',
  'target_hash',
  'stale',
  'field',
];

/**
 * Validates a parsed reviewer-feedback payload against the innfo-console
 * feedback contract (mirrors iNNfo/specs/bluepriNNts/console/feedback.schema.json).
 * Unknown draft fields are ignored. Throws naming the offending item id.
 * @param {any} parsed
 * @returns {{ meta: Record<string, any>, items: Array<Record<string, any>> }}
 */
function validateFeedbackJson(parsed) {
  const fail = (msg) => {
    throw new Error(`feedback: ${msg}`);
  };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('document must be an object with meta and items');
  }
  const meta = parsed.meta;
  if (!meta || typeof meta !== 'object') fail('meta: required object is missing');
  for (const key of FORBIDDEN_FEEDBACK_META_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meta, key)) {
      fail(`meta.${key}: forbidden property is present`);
    }
  }
  for (const key of Object.keys(meta)) {
    if (key.startsWith('source_model') && !FORBIDDEN_FEEDBACK_META_KEYS.includes(key)) {
      fail(`meta.${key}: forbidden property is present`);
    }
  }
  for (const field of ['source_knowledge', 'artifact', 'artifact_version', 'author', 'viewer']) {
    if (!meta[field] || typeof meta[field] !== 'string') fail(`meta.${field}: required non-empty string is missing`);
  }
  if (!/^V_\d+-\d+-\d+$/.test(String(meta.source_knowledge_version || ''))) {
    fail(`meta.source_knowledge_version: must match V_x-y-z (got ${meta.source_knowledge_version})`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(String(meta.exported_at || ''))) {
    fail(`meta.exported_at: must be ISO-8601 with seconds (got ${meta.exported_at})`);
  }
  const slug = meta.feedback_slug;
  if (typeof slug !== 'string' || slug.trim() === '') fail('meta.feedback_slug: required slug is missing');
  if (meta.source_sha256 !== undefined) {
    if (typeof meta.source_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(meta.source_sha256)) {
      fail('meta.source_sha256: must be a 64-character hex string');
    }
  }
  if (!Array.isArray(parsed.items)) fail('items: required array is missing');

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    const where = item && typeof item.id === 'string' ? item.id : `#${i}`;
    if (!item || typeof item !== 'object') fail(`${where}: must be an object`);
    for (const key of FORBIDDEN_FEEDBACK_ITEM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        fail(`${where}.${key}: forbidden property is present`);
      }
    }
    if (!/^fb-\d{3,}$/.test(String(item.id || ''))) fail(`${where}: id must match fb-NNN (got ${item.id})`);
    if (!FEEDBACK_ITEM_KINDS.includes(item.kind)) {
      fail(`${where}: kind must be one of ${FEEDBACK_ITEM_KINDS.join('|')} (got ${item.kind})`);
    }
    if (!item.target || typeof item.target !== 'object' || Object.keys(item.target).length === 0) {
      fail(`${where}: target must be a non-empty object`);
    }
    if (item.base_hash !== undefined) {
      if (typeof item.base_hash !== 'string' || !/^[0-9a-f]{16}$/.test(item.base_hash)) {
        fail(`${where}.base_hash: must match ^[0-9a-f]{16}$`);
      }
    }
  }
  return { meta, items: parsed.items };
}

/**
 * Converts reviewer-feedback JSON into citable markdown: one ## NN Meta
 * section plus one ### heading per item so each item is addressable via
 * sources:: <file>.md#<fb-NNN>.
 * @param {string} content
 * @param {string} baseName
 * @returns {string}
 */
function convertFeedbackJson(content, baseName) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`feedback: invalid JSON in ${baseName} (${err.message})`);
  }
  const { meta, items } = validateFeedbackJson(parsed);

  let out = `# NN Feedback: ${baseName}\n\n`;
  out += `## NN Meta\n\n`;
  out += `- **Source kNNowledge**: ${meta.source_knowledge} (${meta.source_knowledge_version})\n`;
  out += `- **Artifact**: ${meta.artifact} (v${meta.artifact_version})\n`;
  out += `- **Exported At**: ${meta.exported_at}\n`;
  out += `- **Author**: ${meta.author}\n`;
  out += `- **Slug**: ${meta.feedback_slug}\n`;
  out += `- **Viewer**: ${meta.viewer}\n\n`;

  out += `## NN Items (${items.length})\n\n`;
  for (const item of items) {
    out += `### ${item.id}\n\n`;
    out += `- **Kind**: ${item.kind}\n`;
    const target = item.target || {};
    const targetBits = Object.keys(target).map((k) => `${k}: ${target[k]}`);
    if (targetBits.length > 0) out += `- **Target**: ${targetBits.join('; ')}\n`;
    if (item.original !== undefined) out += `- **Original**: ${String(item.original)}\n`;
    if (item.proposed !== undefined) out += `- **Proposed**: ${String(item.proposed)}\n`;
    if (item.comment) out += `- **Comment**: ${item.comment}\n`;
    out += `\n`;
  }
  return out;
}

/**
 * Converts JSON content into structured markdown dataset schema profile or formatted code block.
 * Removes legacy Slack/Teams chat heuristics.
 * @param {string} content
 * @param {string} baseName
 * @returns {string}
 */
function convertJson(content, baseName) {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return `# NN Dataset Schema: ${baseName}\n\n*Empty JSON dataset*\n`;
      }
      if (typeof parsed[0] === 'object' && parsed[0] !== null) {
        // Uniform array of objects -> Profile as dataset
        const headerSet = new Set();
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            for (const k of Object.keys(item)) headerSet.add(k);
          }
        }
        const headers = Array.from(headerSet);

        // Column profiling
        const colStats = headers.map((header) => {
          let nullCount = 0;
          let numericCount = 0;
          let numMin = Infinity;
          let numMax = -Infinity;
          let numSum = 0;
          let dateCount = 0;

          for (const row of parsed) {
            const val = row[header];
            if (val === undefined || val === null || val === '') {
              nullCount++;
              continue;
            }
            const num = Number(val);
            if (typeof val === 'number' || (!isNaN(num) && typeof val !== 'boolean')) {
              numericCount++;
              numSum += num;
              if (num < numMin) numMin = num;
              if (num > numMax) numMax = num;
            } else if (typeof val === 'string' && !isNaN(Date.parse(val)) && val.length >= 8) {
              dateCount++;
            }
          }

          const nonNullCount = parsed.length - nullCount;
          let inferredType = 'string';
          let summaryMetrics = '-';

          if (nonNullCount > 0 && numericCount / nonNullCount > 0.8) {
            inferredType = Number.isInteger(numMin) && Number.isInteger(numMax) ? 'integer' : 'float';
            const avg = (numSum / numericCount).toFixed(2);
            summaryMetrics = `min: ${numMin}, max: ${numMax}, avg: ${avg}`;
          } else if (nonNullCount > 0 && dateCount / nonNullCount > 0.8) {
            inferredType = 'date';
          } else if (nonNullCount > 0 && parsed.every(r => r[header] === undefined || r[header] === null || typeof r[header] === 'boolean')) {
            inferredType = 'boolean';
          }

          return {
            header,
            inferredType,
            nullCount,
            summaryMetrics,
          };
        });

        let out = `# NN Dataset Schema: ${baseName}\n\n`;
        out += '| Column | Inferred Type | Null Count | Summary Metrics |\n';
        out += '|---|---|---|---|\n';
        for (const col of colStats) {
          out += `| ${col.header} | ${col.inferredType} | ${col.nullCount} | ${col.summaryMetrics} |\n`;
        }

        out += `\n## NN Summary Statistics\n\n`;
        out += `- **Total Rows**: ${parsed.length.toLocaleString()}\n`;
        out += `- **Total Columns**: ${headers.length}\n`;
        out += `- **Columns**: ${headers.join(', ')}\n\n`;

        const sampleLimit = Math.min(parsed.length, 15);
        out += `## NN Sample Data (First ${sampleLimit} Rows)\n\n`;
        out += `| ${headers.join(' | ')} |\n`;
        out += `| ${headers.map(() => '---').join(' | ')} |\n`;
        for (let i = 0; i < sampleLimit; i++) {
          const row = parsed[i];
          const cells = headers.map((h) => {
            const val = row[h];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val).replace(/\|/g, '\\|');
            return String(val).replace(/\|/g, '\\|');
          });
          out += `| ${cells.join(' | ')} |\n`;
        }
        return out;
      }
    }

    // General JSON object or primitives array -> fenced json code block with metadata header
    return `# ${baseName}\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`;
  } catch {
    return `# ${baseName}\n\n\`\`\`json\n${content.trim()}\n\`\`\`\n`;
  }
}

/**
 * Converts recognized plain text / structured formats directly to markdown content.
 * @param {string} ext
 * @param {string} filePath
 * @param {string} baseName
 * @returns {string}
 */
function convertOkFormat(ext, filePath, baseName) {
  const content = fs.readFileSync(filePath, 'utf8');
  switch (ext) {
    case '.md':
      return stripFrontmatter(content);
    case '.json':
      if (isFeedbackJsonPath(filePath)) return convertFeedbackJson(content, baseName);
      return convertJson(content, baseName);
    case '.csv':
      return convertCsv(content, baseName);
    case '.srt':
    case '.vtt':
      return convertSubtitles(content, baseName);
    case '.html':
    case '.htm':
      return `# ${baseName}\n\n${htmlToPlainText(content)}`;
    case '.txt':
    default:
      return reflowExtractedText(content);
  }
}

/**
 * Heuristic reflow for text extracted from binary documents (PDF/DOCX/TXT).
 *
 * `pdf-parse` emits one logical line per visual line, preserving mid-sentence
 * breaks, the double spaces of justified text, zero-width characters, page
 * numbers, and no heading structure. This normalises that into readable
 * markdown with citable section headings:
 *
 *   1. strip zero-width / soft-hyphen characters and NBSP
 *   2. re-join words hyphen-split across a line break
 *   3. collapse inner whitespace and blank-line runs
 *   4. promote clause headings to `##` / `###` (numbered Titles, ALL-CAPS
 *      lines, `Schedule N`, and `n.m` sub-clauses)
 *   5. drop isolated page-number lines
 *   6. re-join wrapped lines into paragraphs, keeping item boundaries
 *
 * The transformation is word-preserving: it only rewrites whitespace and adds
 * heading markers, so no clause content is invented or dropped. Dense numeric
 * blocks (spreadsheet-like tables) are left untouched to avoid mangling them.
 *
 * @param {string} text
 * @returns {string}
 */
const HEADING_RE = {
  schedule: /^Schedule\s+\d+$/i,
  numberedTitle: /^(\d{1,2})\.\s*([A-Z][A-Z0-9 ,&'’()\-\/]{2,})$/,
  subClause: /^(\d{1,2}\.\d{1,2})\s*(.*)$/,
  standaloneCaps: /^[A-Z][A-Z0-9 ,&'’()\-\/]*$/,
};

/**
 * Classifies a single line as a clause heading.
 * @param {string} line
 * @returns {{ heading: string, rest?: string, caps?: boolean } | null}
 */
function classifyExtractedHeading(line) {
  if (HEADING_RE.schedule.test(line)) return { heading: `## ${line}` };

  const numbered = line.match(HEADING_RE.numberedTitle);
  if (numbered) return { heading: `## ${numbered[1]}. ${numbered[2].trim()}` };

  const sub = line.match(HEADING_RE.subClause);
  if (sub && sub[2] && /^[A-ZÀ-Þ]/.test(sub[2])) {
    return { heading: `### ${sub[1]}`, rest: sub[2].trim() };
  }

  const words = line.split(/\s+/);
  const isMarker = /^(WHEREAS|CLAUSES|AGREED)$/i.test(line);
  if (
    line.length >= 3 &&
    line.length <= 60 &&
    HEADING_RE.standaloneCaps.test(line) &&
    /[A-Z]{2}/.test(line) &&
    words.length <= 8 &&
    (words.length >= 2 || isMarker)
  ) {
    return { heading: `## ${line}`, caps: true };
  }

  return null;
}

/** A spreadsheet-like row: digit-dense relative to letters (never merged into prose). */
function isDenseNumericLine(line) {
  const digits = (line.match(/[0-9]/g) || []).length;
  if (digits < 6) return false;
  const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return digits >= letters * 2;
}

/** A wrapped line begins a new paragraph: typographic-quote definition item, list, or numbered clause. */
const NEW_ITEM_RE = /^(?:[“„]|\([A-Za-z0-9]{1,3}\)|\d+(?:\.\d+)*[.)]?\s|[•‣▪◦]\s)/;

/**
 * A line that is already structural Markdown and must not be reflowed.
 * Protects DOCX (mammoth) / TXT output: keeps `#` headings, lists, tables,
 * blockquotes and code fences intact instead of joining them into prose.
 */
const MD_BLOCK_RE = /^(?:#{1,6}\s|>\s?|[-*+]\s|\d{1,2}[.)]\s|\||```|~~~)/;

/**
 * Reflows raw extracted text into readable, sectioned markdown.
 * @param {string} text
 * @returns {string}
 */
function reflowExtractedText(text) {
  if (!text || typeof text !== 'string') return '';

  let t = text.replace(/\r\n?/g, '\n');
  t = t.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  t = t.replace(/\u00A0/g, ' ');
  // Re-join a word hyphen-split across a line break: "partici-\npativo" -> "participativo".
  t = t.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([a-zà-öø-ÿ])/g, '$1$2');

  const rawLines = t
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim());
  // Merge a stray single-letter fragment left on its own line ("B" + "ETWEEN").
  for (let i = 0; i < rawLines.length - 1; i++) {
    if (/^[A-Z]$/.test(rawLines[i]) && /^[A-Z]/.test(rawLines[i + 1])) {
      rawLines[i + 1] = rawLines[i] + rawLines[i + 1];
      rawLines[i] = null;
    }
  }

  const lines = [];
  for (const line of rawLines) {
    if (line === null) continue;
    if (line === '') {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    lines.push(line);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  const blocks = [];
  let block = [];
  for (const line of lines) {
    if (line === '') {
      if (block.length) {
        blocks.push(block);
        block = [];
      }
      continue;
    }
    block.push(line);
  }
  if (block.length) blocks.push(block);

  const out = [];
  for (const chunk of blocks) {
    let paragraph = [];
    const flush = () => {
      if (paragraph.length) {
        out.push(paragraph.join(' '));
        paragraph = [];
      }
    };

    for (let i = 0; i < chunk.length; i++) {
      const line = chunk[i];
      const heading = classifyExtractedHeading(line);
      if (heading) {
        flush();
        if (heading.caps) {
          // An ALL-CAPS title wrapped over consecutive lines is one heading.
          let text = line;
          while (i + 1 < chunk.length) {
            const next = classifyExtractedHeading(chunk[i + 1]);
            if (next && next.caps) text += ` ${chunk[++i]}`;
            else break;
          }
          out.push(`## ${text}`);
        } else {
          out.push(heading.heading);
          if (heading.rest) paragraph = [heading.rest];
        }
        continue;
      }

      // Already-structural Markdown (DOCX/TXT): preserve the line verbatim.
      if (MD_BLOCK_RE.test(line)) {
        flush();
        out.push(line);
        continue;
      }

      // Spreadsheet-like row: keep it on its own line, never merged into prose.
      if (isDenseNumericLine(line)) {
        flush();
        out.push(line);
        continue;
      }

      // Isolated page number (a lone 1-3 digit line) is extraction noise.
      if (/^\d{1,3}$/.test(line)) continue;

      const prev = paragraph[paragraph.length - 1];
      const startsNew =
        paragraph.length === 0 ||
        NEW_ITEM_RE.test(line) ||
        /[.!?]$/.test(prev || '');
      if (startsNew) {
        flush();
        paragraph = [line];
      } else {
        paragraph.push(line);
      }
    }
    flush();
  }

  // Assemble: blank line between blocks, but keep consecutive table rows and
  // list items tight so a Markdown table/list does not break apart.
  const isTight = (s) =>
    s.startsWith('|') || /^[-*+]\s/.test(s) || /^\d{1,2}[.)]\s/.test(s);
  let result = '';
  for (let i = 0; i < out.length; i++) {
    if (i > 0) result += isTight(out[i - 1]) && isTight(out[i]) ? '\n' : '\n\n';
    result += out[i];
  }
  return ensureTableSeparators(result.trim());
}

/**
 * Converts DOCX file to markdown using mammoth.
 * @param {string} filePath
 * @returns {Promise<{ body: string, [key: string]: any }>}
 */
async function convertDocx(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.convertToMarkdown({ path: filePath });
  return { body: reflowExtractedText(result.value) };
}

/** Horizontal gap (px) that separates two table columns within a line. */
const PDF_COL_GAP = 8;
/** Vertical tolerance (px) for grouping text items into one visual line. */
const PDF_Y_TOL = 2;

/** True when a line's cells look like a table row (short, mostly containing digits). */
function isTabularCells(cells) {
  if (cells.length < 4) return false;
  if (!cells.every((c) => c.length <= 40)) return false;
  if (cells.length >= 5) return true;
  const withDigit = cells.filter((c) => /[0-9]/.test(c)).length;
  return withDigit / cells.length >= 0.5;
}

/**
 * Reconstructs page text from pdf.js text items, preserving the document's own
 * spacing (`item.str` is verbatim) and splitting lines by vertical position.
 * Within a line, a large horizontal gap between items marks a table column, so
 * a tabular line is emitted as a pipe-delimited Markdown row.
 * Pure function — unit-tested with synthetic pdf.js items.
 *
 * @param {Array<{ str: string, width?: number, transform: number[] }>} items
 * @returns {string}
 */
function layoutItemsToText(items) {
  if (!Array.isArray(items)) return '';

  const lines = [];
  let current = null;
  for (const item of items) {
    if (!item || typeof item.str !== 'string' || item.str === '' || !Array.isArray(item.transform)) continue;
    const y = item.transform[5];
    if (!current || Math.abs(current.y - y) > PDF_Y_TOL) {
      current = { y, items: [] };
      lines.push(current);
    }
    current.items.push(item);
  }

  const out = [];
  for (const line of lines) {
    const cells = [];
    let text = '';
    let end = null;
    for (const item of line.items) {
      const x = item.transform[4];
      const w = typeof item.width === 'number' ? item.width : 0;
      if (end !== null && x - end > PDF_COL_GAP) {
        cells.push(text);
        text = '';
      }
      text += item.str;
      end = x + w;
    }
    cells.push(text);

    const clean = cells.map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (isTabularCells(clean)) {
      out.push(`| ${clean.join(' | ')} |`);
    } else {
      const joined = cells.join(' ').replace(/[ \t]+/g, ' ').trim();
      if (joined) out.push(joined);
    }
  }
  return out.join('\n');
}

/**
 * Inserts a Markdown table separator (`| --- |`) after the first row of any
 * pipe-delimited block, unless one is already present.
 * @param {string} text
 * @returns {string}
 */
function ensureTableSeparators(text) {
  const lines = text.split('\n');
  const out = [];
  let prevWasRow = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRow = line.startsWith('|');
    if (isRow && !prevWasRow) {
      out.push(line);
      const next = lines[i + 1];
      if (!(next && /^\|[\s\-:|]+\|$/.test(next))) {
        const cols = Math.max((line.match(/\|/g) || []).length - 1, 1);
        out.push('|' + Array(cols).fill(' --- ').join('|') + '|');
      }
    } else {
      out.push(line);
    }
    prevWasRow = isRow;
  }
  return out.join('\n');
}

/**
 * Extracts PDF text positionally via pdf.js (bundled with pdf-parse), so table
 * columns survive as Markdown rows. Falls back to pdf-parse's flat text.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractPdfWithLayout(buffer) {
  const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  pdfjs.disableWorker = true;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(layoutItemsToText(content.items));
  }
  const meta = await doc.getMetadata().catch(() => null);
  doc.destroy();
  return { text: pages.join('\n\n'), info: meta ? meta.info : null };
}

/**
 * Converts PDF file to markdown using pdf-parse with fallback placeholder.
 * @param {string} filePath
 * @param {string} baseName
 * @returns {Promise<{ body: string, partial?: boolean, note?: string, info?: any }>}
 */
async function convertPdf(filePath, baseName) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    let text;
    let info = null;
    try {
      const laid = await extractPdfWithLayout(buffer);
      text = laid.text;
      info = laid.info;
    } catch {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
      info = parsed.info;
    }
    return { body: `# ${baseName}\n\n${reflowExtractedText(text)}`, info };
  } catch (pdfErr) {
    return {
      body: `# ${baseName}\n\n*PDF Content Ingested (Placeholder)*\n\n[PDF: ${path.basename(filePath)} needs manual verification or a PDF parser package to extract text fully.]`,
      partial: true,
      note: pdfErr.message,
    };
  }
}

/**
 * Converts spreadsheet workbook sheets into markdown tables using xlsx.
 * @param {string} filePath
 * @param {string} baseName
 * @returns {{ body: string }}
 */
function convertXlsx(filePath, baseName) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  let body = `# ${baseName}\n\n`;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    body += `## Sheet: ${sheetName}\n\n`;
    if (json.length > 0) {
      const headers = Object.keys(json[0]);
      body += `| ${headers.join(' | ')} |\n`;
      body += `| ${headers.map(() => '---').join(' | ')} |\n`;
      for (const row of json) {
        body += `| ${headers.map((h) => String(row[h] ?? '')).join(' | ')} |\n`;
      }
    } else {
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cells = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          cells.push(String(sheet[addr]?.v ?? ''));
        }
        body += `| ${cells.join(' | ')} |\n`;
      }
    }
    body += '\n';
  }
  return { body };
}

const PROMPT_CONVERTERS = {
  '.docx': convertDocx,
  '.pdf': convertPdf,
  '.xlsx': convertXlsx,
  '.xls': convertXlsx,
};

/**
 * Checks if an optional npm dependency is resolvable.
 * @param {string} pkgName
 * @param {string} [basePath]
 * @returns {boolean}
 */
function isDepInstalled(pkgName, basePath) {
  const searchPaths = basePath
    ? [basePath]
    : [__dirname, path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')];
  try {
    require.resolve(pkgName, { paths: searchPaths });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks and installs optional package dependencies required for prompt formats.
 * @param {string} ext
 * @param {Record<string, any>} options
 * @param {Record<string, { pkg: string, label: string }>} extDeps
 * @param {string} [skillDir]
 * @returns {Promise<{ ok: boolean, status?: string, reason?: string }>}
 */
async function ensureDependency(ext, options, extDeps, skillDir) {
  const dep = extDeps[ext];
  const targetDir = skillDir || path.resolve(__dirname, '../..');
  if (!dep || isDepInstalled(dep.pkg, targetDir)) return { ok: true };

  let install = false;
  if (options.depPromptCallback) {
    install = await options.depPromptCallback(ext);
  } else if (options.autoAcceptPrompt) {
    install = true;
  }

  if (!install) {
    return { ok: false, status: '⚠️ Skipped', reason: `Dependency ${dep.pkg} not installed. Skipped.` };
  }

  try {
    console.log(`Installing optional dependency "${dep.pkg}" for ${ext}...`);
    execSync(`npm install ${dep.pkg}`, { cwd: targetDir, stdio: 'pipe' });
    console.log(`"${dep.pkg}" installed successfully.`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: '⚠️ Skipped',
      reason: `Could not automatically install "${dep.pkg}". To process "${ext}" files, run "npm install ${dep.pkg}" inside "${path.basename(targetDir)}" or convert files to markdown/plain text.`
    };
  }
}

module.exports = {
  parseCsv,
  stripFrontmatter,
  htmlToPlainText,
  reflowExtractedText,
  layoutItemsToText,
  convertJson,
  convertFeedbackJson,
  validateFeedbackJson,
  isFeedbackJsonPath,
  convertOkFormat,
  convertDocx,
  convertPdf,
  convertXlsx,
  PROMPT_CONVERTERS,
  isDepInstalled,
  ensureDependency,
};
