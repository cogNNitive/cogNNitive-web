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
const FEEDBACK_ITEM_STATUSES = ['pending', 'applied', 'rejected'];

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
  for (const field of ['source_knowledge', 'artifact', 'artifact_version', 'author', 'viewer']) {
    if (!meta[field] || typeof meta[field] !== 'string') fail(`meta.${field}: required non-empty string is missing`);
  }
  if (!/^V_\d+-\d+-\d+$/.test(String(meta.source_knowledge_version || ''))) {
    fail(`meta.source_knowledge_version: must match V_x-y-z (got ${meta.source_knowledge_version})`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(String(meta.exported_at || ''))) {
    fail(`meta.exported_at: must be ISO-8601 with seconds (got ${meta.exported_at})`);
  }
  const slug = meta.feedback_slug || meta.session_label;
  if (typeof slug !== 'string' || slug.trim() === '') fail('meta.feedback_slug: required slug is missing');
  if (!Array.isArray(parsed.items)) fail('items: required array is missing');

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    const where = item && typeof item.id === 'string' ? item.id : `#${i}`;
    if (!item || typeof item !== 'object') fail(`${where}: must be an object`);
    if (!/^fb-\d{3,}$/.test(String(item.id || ''))) fail(`${where}: id must match fb-NNN (got ${item.id})`);
    if (!FEEDBACK_ITEM_KINDS.includes(item.kind)) {
      fail(`${where}: kind must be one of ${FEEDBACK_ITEM_KINDS.join('|')} (got ${item.kind})`);
    }
    if (!item.target || typeof item.target !== 'object' || Object.keys(item.target).length === 0) {
      fail(`${where}: target must be a non-empty object`);
    }
    if (!FEEDBACK_ITEM_STATUSES.includes(item.status)) {
      fail(`${where}: status must be one of ${FEEDBACK_ITEM_STATUSES.join('|')} (got ${item.status})`);
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
  out += `- **Slug**: ${meta.feedback_slug || meta.session_label}\n`;
  out += `- **Viewer**: ${meta.viewer}\n\n`;

  out += `## NN Items (${items.length})\n\n`;
  for (const item of items) {
    out += `### ${item.id} (${item.kind}, ${item.status})\n\n`;
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
      return content;
  }
}

/**
 * Converts DOCX file to markdown using mammoth.
 * @param {string} filePath
 * @returns {Promise<{ body: string, [key: string]: any }>}
 */
async function convertDocx(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.convertToMarkdown({ path: filePath });
  return { body: result.value };
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
    const data = await pdfParse(fs.readFileSync(filePath));
    return { body: `# ${baseName}\n\n${data.text}`, info: data.info };
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
