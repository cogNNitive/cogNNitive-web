#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function printUsage() {
  console.log(`
Usage:
  node scripts/generate-docsify-suite.mjs <model-path> [options]

Options:
  --output-dir, -o <dir>  Target output directory (default: model directory)
  --sidebar-only          Generate only _sidebar.md
  --navbar-only           Generate only _navbar.md
  --llms-only             Generate only llms.txt and ai-index.yaml
  --all                   Generate all compatible artifacts (default)
  --dry-run               Print outputs to stdout without writing files
  --skip-file-check       Skip filesystem checks for source markdown files
  --help, -h              Show this help message
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let modelPath = null;
  let outputDir = null;
  let dryRun = false;
  let skipFileCheck = false;
  let mode = 'all';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output-dir' || arg === '-o') {
      outputDir = args[++i];
    } else if (arg === '--sidebar-only') {
      mode = 'sidebar';
    } else if (arg === '--navbar-only') {
      mode = 'navbar';
    } else if (arg === '--llms-only') {
      mode = 'llms';
    } else if (arg === '--all') {
      mode = 'all';
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--skip-file-check') {
      skipFileCheck = true;
    } else if (!arg.startsWith('-') && !modelPath) {
      modelPath = arg;
    }
  }

  if (!modelPath) {
    console.error('❌ Error: Model path is required.');
    printUsage();
    process.exit(1);
  }

  return { modelPath, outputDir, dryRun, skipFileCheck, mode };
}

export function parseNNModel(content) {
  const lines = content.split(/\r?\n/);
  let docSite = null;
  const sections = new Map();
  const pages = [];
  const navbarItems = [];
  const assets = [];
  let currentEntity = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Match entity headers: ## NN Concept: EntityName
    const entityMatch = trimmed.match(/^##\s+NN\s+([^:]+):\s*(.+)$/);
    if (entityMatch) {
      const [, concept, name] = entityMatch;
      currentEntity = {
        concept: concept.trim(),
        id: name.trim(),
        fields: {},
      };

      if (currentEntity.concept === 'DocSite') {
        docSite = currentEntity;
      } else if (currentEntity.concept === 'Section') {
        sections.set(currentEntity.id, currentEntity);
      } else if (currentEntity.concept === 'Page') {
        pages.push(currentEntity);
      } else if (currentEntity.concept === 'NavbarItem') {
        navbarItems.push(currentEntity);
      } else if (currentEntity.concept === 'Asset') {
        assets.push(currentEntity);
      }
      continue;
    }

    // Match fields: key:: value
    const fieldMatch = trimmed.match(/^([a-zA-Z0-9_-]+)::\s*(.*)$/);
    if (fieldMatch && currentEntity) {
      const [, key, val] = fieldMatch;
      let cleanVal = val.trim();
      // Unwrap [[Target]] reference if present
      const refMatch = cleanVal.match(/^\[\[(.*)\]\]$/);
      if (refMatch) {
        cleanVal = refMatch[1].trim();
      }
      currentEntity.fields[key] = cleanVal;
    }
  }

  return { docSite, sections, pages, navbarItems, assets };
}

function buildSidebarMarkdown(sections, pages) {
  const sortedSections = Array.from(sections.values()).sort((a, b) => {
    const orderA = parseInt(a.fields.section_order || a.fields.order || '999', 10);
    const orderB = parseInt(b.fields.section_order || b.fields.order || '999', 10);
    return orderA - orderB;
  });

  const sectionPages = new Map();
  const rootPages = [];

  for (const page of pages) {
    const parent = page.fields.parent;
    if (parent && sections.has(parent)) {
      if (!sectionPages.has(parent)) {
        sectionPages.set(parent, []);
      }
      sectionPages.get(parent).push(page);
    } else {
      rootPages.push(page);
    }
  }

  const sortPages = (pageList) => {
    return pageList.sort((a, b) => {
      const orderA = parseInt(a.fields.order || '999', 10);
      const orderB = parseInt(b.fields.order || '999', 10);
      return orderA - orderB;
    });
  };

  const lines = [];

  // 1. Root-level pages
  for (const page of sortPages(rootPages)) {
    const title = page.fields.title || page.id;
    const route = page.fields.route || page.fields.source.replace(/\.md$/, '');
    lines.push(`- [${title}](${route})`);
  }

  // 2. Sections and their children
  for (const section of sortedSections) {
    const pagesForSection = sectionPages.get(section.id) || [];
    if (pagesForSection.length === 0) continue;

    if (lines.length > 0) {
      lines.push('');
    }

    const sectionTitle = section.fields.title || section.id;
    lines.push(`- **${sectionTitle}**`);

    for (const page of sortPages(pagesForSection)) {
      const title = page.fields.title || page.id;
      const route = page.fields.route || page.fields.source.replace(/\.md$/, '');
      lines.push(`  - [${title}](${route})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildNavbarMarkdown(navbarItems) {
  if (!navbarItems || navbarItems.length === 0) {
    return null;
  }

  const sortedItems = navbarItems.sort((a, b) => {
    const orderA = parseInt(a.fields.order || '999', 10);
    const orderB = parseInt(b.fields.order || '999', 10);
    return orderA - orderB;
  });

  const lines = [];
  for (const item of sortedItems) {
    const label = item.fields.label || item.id;
    const url = item.fields.url || '#';

    if (label.includes('[') && label.includes('](')) {
      lines.push(`* ${label}`);
    } else if (label.includes(': ')) {
      const colonIndex = label.indexOf(': ');
      const prefix = label.substring(0, colonIndex + 2);
      const text = label.substring(colonIndex + 2);
      lines.push(`* ${prefix}[${text}](${url})`);
    } else {
      lines.push(`* [${label}](${url})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildLlmsTxt(docSite, sections, pages) {
  const title = docSite?.fields.site_title || 'Documentation';
  const desc = docSite?.fields.site_description || 'Technical Documentation';

  const lines = [
    `# ${title}`,
    `> ${desc}`,
    '',
    '## Documentation Index',
    '',
  ];

  for (const page of pages) {
    const pageTitle = page.fields.title || page.id;
    const route = page.fields.route || page.fields.source || '';
    const description = page.fields.description || '';
    lines.push(`- [${pageTitle}](${route})${description ? `: ${description}` : ''}`);
  }

  lines.push('');
  return lines.join('\n');
}

function buildAiIndexYaml(docSite, sections, pages) {
  const title = docSite?.fields.site_title || 'Documentation';
  const desc = docSite?.fields.site_description || '';
  const basePath = docSite?.fields.base_path || '';

  const lines = [
    `site:`,
    `  title: "${title}"`,
    `  description: "${desc}"`,
    `  base_path: "${basePath}"`,
    `pages:`,
  ];

  for (const page of pages) {
    lines.push(`  - id: "${page.id}"`);
    lines.push(`    title: "${page.fields.title || page.id}"`);
    lines.push(`    route: "${page.fields.route || ''}"`);
    lines.push(`    source: "${page.fields.source || ''}"`);
    if (page.fields.parent) {
      lines.push(`    parent: "${page.fields.parent}"`);
    }
    if (page.fields.description) {
      lines.push(`    description: "${page.fields.description.replace(/"/g, '\\"')}"`);
    }
    if (page.fields.tags) {
      lines.push(`    tags: "${page.fields.tags}"`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function run() {
  const { modelPath, outputDir, dryRun, skipFileCheck, mode } = parseArgs();

  const resolvedModelPath = path.isAbsolute(modelPath)
    ? modelPath
    : path.resolve(process.cwd(), modelPath);

  if (!fs.existsSync(resolvedModelPath)) {
    console.error(`❌ Error: Model file not found at: ${resolvedModelPath}`);
    process.exit(1);
  }

  const modelDir = path.dirname(resolvedModelPath);
  const targetDir = outputDir
    ? (path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir))
    : modelDir;

  console.log(`🔍 [Docsify Suite Generator] Reading model: ${path.relative(repoRoot, resolvedModelPath)}`);
  const content = fs.readFileSync(resolvedModelPath, 'utf8');
  const { docSite, sections, pages, navbarItems, assets } = parseNNModel(content);

  console.log(`📋 Found ${sections.size} sections, ${pages.length} pages, ${navbarItems.length} navbar items, ${assets.length} assets.`);

  // Audit and validate sources
  if (!skipFileCheck) {
    let auditErrors = 0;
    for (const page of pages) {
      const source = page.fields.source;
      if (!source) {
        console.error(`❌ [Audit Failure] Page "${page.id}" is missing required "source::" field.`);
        auditErrors++;
        continue;
      }

      if (!source.startsWith('http://') && !source.startsWith('https://')) {
        const sourceFilePath = path.join(modelDir, source);
        if (!fs.existsSync(sourceFilePath)) {
          console.error(`❌ [Missing File] Page "${page.id}" source not found: ${sourceFilePath}`);
          auditErrors++;
        }
      }
    }

    if (auditErrors > 0) {
      console.error(`\n❌ Validation failed: ${auditErrors} error(s) encountered in model source references.`);
      process.exit(1);
    }

    console.log(`✅ All source files verified on disk.`);
  } else {
    console.log(`⚠️ Skipping filesystem presence checks (--skip-file-check enabled).`);
  }

  // 1. Sidebar
  if (mode === 'all' || mode === 'sidebar') {
    const sidebarContent = buildSidebarMarkdown(sections, pages);
    const sidebarPath = path.join(targetDir, '_sidebar.md');
    if (dryRun) {
      console.log('\n--- [Dry Run Output: _sidebar.md] ---');
      console.log(sidebarContent);
    } else {
      fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
      console.log(`✨ Generated sidebar written to: ${path.relative(repoRoot, sidebarPath)}`);
    }
  }

  // 2. Navbar
  if (mode === 'all' || mode === 'navbar') {
    const navbarContent = buildNavbarMarkdown(navbarItems);
    if (navbarContent) {
      const navbarPath = path.join(targetDir, '_navbar.md');
      if (dryRun) {
        console.log('\n--- [Dry Run Output: _navbar.md] ---');
        console.log(navbarContent);
      } else {
        fs.writeFileSync(navbarPath, navbarContent, 'utf8');
        console.log(`✨ Generated navbar written to: ${path.relative(repoRoot, navbarPath)}`);
      }
    }
  }

  // 3. LLMs and AI Index
  if (mode === 'all' || mode === 'llms') {
    const llmsContent = buildLlmsTxt(docSite, sections, pages);
    const llmsPath = path.join(targetDir, 'llms.txt');
    const aiIndexContent = buildAiIndexYaml(docSite, sections, pages);
    const aiIndexPath = path.join(targetDir, 'ai-index.yaml');

    if (dryRun) {
      console.log('\n--- [Dry Run Output: llms.txt] ---');
      console.log(llmsContent);
      console.log('\n--- [Dry Run Output: ai-index.yaml] ---');
      console.log(aiIndexContent);
    } else {
      fs.writeFileSync(llmsPath, llmsContent, 'utf8');
      console.log(`✨ Generated llms.txt written to: ${path.relative(repoRoot, llmsPath)}`);
      fs.writeFileSync(aiIndexPath, aiIndexContent, 'utf8');
      console.log(`✨ Generated ai-index.yaml written to: ${path.relative(repoRoot, aiIndexPath)}`);
    }
  }
}

// Is-main guard (design D2): importing this module for `parseNNModel` alone
// (e.g. from scripts/generate-docs-facts.mjs) must not also trigger this
// CLI's own `run()`, which reads argv and calls `process.exit`.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run();
}
