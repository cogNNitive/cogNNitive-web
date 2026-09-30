/**
 * skills/nn-preflight/scripts/lib/yaml-lite.js
 *
 * Focused YAML subset parser + Markdown frontmatter extractor.
 * Zero dependencies — required by scripts that run at agent session bootstrap.
 */

function parseScalar(text) {
  const t = text.trim();
  if (t === '') return null;
  if (t.startsWith('[') && t.endsWith(']')) {
    return t.slice(1, -1).split(',')
      .map(p => p.trim())
      .filter(p => p !== '')
      .map(p => parseScalar(p));
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
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
  if (rest === '') {
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
  while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('- ')) {
    const rest = lines[pos].text.slice(2).trim();
    let next = pos + 1;
    let item;
    if (rest === '') {
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
        if (value === '') {
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
          while (next < lines.length && lines[next].indent === itemIndent && !lines[next].text.startsWith('- ')) {
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
  if (lines[pos].text.startsWith('- ')) {
    return parseSequence(lines, pos, indent);
  }
  const obj = {};
  while (pos < lines.length && lines[pos].indent === indent && !lines[pos].text.startsWith('- ')) {
    const [key, value, next] = parseMappingItem(lines, pos, indent);
    if (key === null) break;
    obj[key] = value;
    pos = next;
  }
  return [obj, pos];
}

function parseFocusedYaml(text) {
  const lines = text.split(/\r?\n/)
    .map((raw) => ({ indent: raw.match(/^[ \t]*/)[0].length, text: raw.trim() }))
    .filter(l => l.text !== '' && !l.text.startsWith('#'));
  const result = {};
  let pos = 0;
  while (pos < lines.length) {
    const [key, value, next] = parseMappingItem(lines, pos, 0);
    if (key === null) { pos++; continue; }
    result[key] = value;
    pos = next;
  }
  return result;
}

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  const open = lines.findIndex(l => l.trim() === '---');
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
  }
  if (open === -1 || close === -1) {
    throw new Error('no YAML frontmatter (--- delimiters) found');
  }
  return lines.slice(open + 1, close).join('\n');
}

module.exports = {
  parseScalar,
  parseMappingItem,
  parseSequence,
  parseBlock,
  parseFocusedYaml,
  parseFrontmatter,
};
