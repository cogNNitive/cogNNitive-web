# Deployment — GitHub Pages

1. Push to GitHub
2. Settings → Pages → Source: **Deploy from a branch** → branch `main`, folder `/docs`
3. If using `CNAME`, add DNS record pointing to `<org>.github.io`
4. Wait 1-2 min, verify at the configured domain

## Structure

```
docs/
├── index.html          ← web root
├── index.md            ← Markdown twin
├── robots.txt
├── sitemap.xml
├── CNAME               ← custom domain (optional)
├── js/analytics.js     ← analytics (optional)
├── .well-known/
│   └── ai-catalog.json
├── documentation/      ← Docsify (optional)
└── app/                ← compiled app (optional)
```

## App Integration (optional)

If the project has a separate app:
- Build output goes to `docs/app/`
- Vite: set `base: '/app/'`
- Link from nav: `<a href="/app/">Open App</a>`

## readme.md

Generate `docs/readme.md` explaining how analytics, contact, and updates work. Include example prompts.
