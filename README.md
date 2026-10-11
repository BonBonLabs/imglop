# imgLop

AI background remover, image tools, Image-to-PDF and QR generator that run in your browser. Built by BonBon Labs.
Your photos, PDFs and QR text are processed on your device.

- Single static file: `index.html` (+ `models/u2netp.onnx`). Host on any static host (e.g. Cloudflare Pages).
- Licensed under **AGPL-3.0** (add the `LICENSE` file, see below). Third-party licenses: `THIRD_PARTY_NOTICES.md`.

## Configure
Edit the placeholders in `index.html`:
- `#authConfig` data attributes: your backend URLs (signup, signin, account, checkout, portal, reset-request, reset-confirm).
- `#subscribeBtn`: Stripe price IDs / Payment Links (publishable values only).
- Careers link and the "Source code" link (`REPLACE-ORG`).

## Self-host the libraries and fonts (recommended before launch)
By default `index.html` loads its libraries from public CDNs and fonts from Google. To keep visitors' data off third parties, run once on your computer (needs Node.js):

```
npm install
npm run vendor
```

This copies the libraries into `vendor/` and fonts into `fonts/`, then rewrites `index.html` to use them. Commit the result. Re-running is safe.
Check that no file is over 25 MB if you deploy on Cloudflare Pages (the script warns you).

## Secrets
Never put Stripe secret keys, webhook secrets or email keys in this repo. They belong in your host's secret settings. See `.env.example`.

## Pro features
Pro status must be verified by your server. Client-side checks can be bypassed by anyone reading the source.

## Contributing
Contributions are accepted under AGPL-3.0.
