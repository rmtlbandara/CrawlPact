---
title: "How to set the Content-Signal HTTP header"
description: "A step-by-step implementation guide for publishing a Content-Signal response header, and where to configure it depending on your hosting setup."
category: "implementation"
publishedDate: "2026-07-24"
---

Content Signals is an emerging convention for declaring simple, machine-readable permissions —
such as whether AI training is allowed — as comma-separated `key=value` pairs, most commonly
delivered as a `Content-Signal` HTTP response header.

## Step 1: Decide the values you want to declare

The currently-documented keys are `search`, `ai-train`, and `ai-input`, each set to `yes` or
`no`. For example, to allow search use but disallow AI training:

```
Content-Signal: search=yes, ai-train=no
```

## Step 2: Add the header at your server or CDN

Where you configure this depends on your hosting setup — the header needs to be added by
whatever serves your responses:

- **Netlify** — a `_headers` file in your publish directory:
  ```
  /*
    Content-Signal: search=yes, ai-train=no
  ```
- **Vercel** — a `headers` entry in `vercel.json`:
  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [{ "key": "Content-Signal", "value": "search=yes, ai-train=no" }]
      }
    ]
  }
  ```
- **Cloudflare Pages/Workers Assets** — a `_headers` file at your project root, in the same
  `path` / `  Header: value` format Netlify uses (this is the same mechanism CrawlPact's own
  site uses for its security headers).
- **Reverse proxy / web server** (Nginx, Apache, Caddy) — add a response header directive in your
  site configuration (e.g. Nginx's `add_header`, Apache's `Header set`).
- **WordPress** — a `functions.php` snippet (or a small plugin) hooked to the `send_headers`
  action, calling `header('Content-Signal: search=yes, ai-train=no')`, since WordPress's own
  request handling is what generates the response.
- **Application framework** — set the header directly in your application's response-handling
  code if you control it there instead.

If your platform isn't listed above, consult its documentation for adding a custom response
header — the syntax varies, but the underlying task (attach one HTTP header to every response) is
the same everywhere.

## Step 3: Verify

Run CrawlPact's [Content Signals checker](/tools/content-signals-checker). It reports whether a
`Content-Signal` header was detected on your homepage, and which recognised keys and values it
found.

## Keep it consistent with your other declarations

If you also publish an RSL declaration, make sure the two agree — CrawlPact specifically flags a
disagreement between RSL prohibiting training and Content Signals declaring `ai-train=yes` for
the same site, since a crawler reading only one of the two could reach either conclusion.

## What this doesn't do

Content Signals is a declaration, not technical enforcement — see [/limitations](/limitations).
Adoption by AI crawler operators varies, since this is still an emerging convention.
