# Analytics — Umami Integration

Ask the user first. Only add with explicit consent.

## Setup

1. Ask if they have an Umami Cloud account
2. If not, guide them to https://cloud.umami.is
3. Get their script tag (contains `data-website-id`)
4. Extract the UUID

## Injector

Create `docs/js/analytics.js`:
```js
(function() {
  var d = document, s = d.createElement('script');
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', '{{UMAMI_WEBSITE_ID}}');
  s.setAttribute('data-auto-track', 'true');
  s.async = true;
  d.head.appendChild(s);
})();
```

Include in every page's `<head>`:
```html
<script src="/js/analytics.js" defer></script>
```

## Docsify SPA

Add after the injector:
```html
<script>
window.addEventListener('load', function () {
  if (typeof Docsify !== 'undefined') {
    Docsify.doneEach(function () {
      if (window.umami) {
        umami.track({ url: window.location.pathname + window.location.search });
      }
    });
  }
});
</script>
```
