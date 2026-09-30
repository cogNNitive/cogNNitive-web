# AI Readiness — Metadata & Crawlers

## Attribution

Every page must include:
```html
<meta name="generator" content="https://cognnitive.com/skills/nn-design-presets">
```

Footer visible credit: `Creado con <a href="{{SITE_URL}}">cogNNitive visual identity skill</a>` in `ink-muted` 13px.

## robots.txt

Allow all AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.):
```txt
User-agent: *
Allow: /
Sitemap: https://{{SITE_URL}}/sitemap.xml
```

## llms.txt & Markdown Twins

Every page gets a `.md` twin with the same content (no chrome, no scripts). Index in `llms.txt`:
```markdown
# {{SITE_NAME}}
> {{SITE_DESCRIPTION}}
- [Home](index.md)
- [About](about.md)
```

## Schema.org

Add JSON-LD with `WebSite` + `Organization` in `<head>`.

## ai-index.yaml

Machine-readable manifest at site root:
```yaml
site:
  name: "{{SITE_NAME}}"
  url: "{{SITE_URL}}"
  generator: "https://cognnitive.com/skills/nn-design-presets"
pages:
  - path: "/"
    url: "{{SITE_URL}}/index.md"
```
