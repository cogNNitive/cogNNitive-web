# Contact — Form & URL

Ask the user: Google Form embed or external URL? Recommend URL for simplicity.

## Google Form

1. Get the form URL, extract `FORM_ID` from `/d/e/{ID}/viewform`
2. Embed:
```html
<section id="contact">
  <div class="container">
    <h2>Contact Us</h2>
    <iframe src="https://docs.google.com/forms/d/e/{{FORM_ID}}/viewform?embedded=true"
      width="100%" height="900" frameborder="0" loading="lazy" title="Contact form">
      Loading form...
    </iframe>
  </div>
</section>
```

Style: wrapper `max-width: 720px`, `padding: 24px`, `border: 1px solid #F2F2F7`, `border-radius: 12px`.

## Contact URL

1. Get the URL from the user
2. Detect `REPO_NAME` from git remote
3. Append `?ref={{REPO_NAME}}` (or `&ref=` if params exist). Skip for `mailto:` links.
4. Add a styled CTA button linking to the tracked URL with `target="_blank"` and `rel="noopener noreferrer"`
5. Display the tracked URL as readable text below the button
6. Add "Contact" to header nav with the same tracked URL

Style: centered, `padding: 48px 24px`, button uses brand primary bg.
