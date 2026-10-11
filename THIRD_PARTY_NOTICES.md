# Third-party components

imgLop's own code is licensed under **AGPL-3.0** (see `LICENSE`). It uses the components below, which keep their own licenses. All of these are compatible with AGPL-3.0 as far as we know. Verify against each project's current license before release.

| Component | Used for | License | How it's loaded |
|---|---|---|---|
| U²-Net (`u2netp`) weights, Xuebin Qin et al. | AI background removal | Apache-2.0 | `models/u2netp.onnx` (self-hosted) |
| rembg (ONNX packaging of the model) | Model distribution/pre- and post-processing steps | MIT | Release asset download; code re-implemented |
| ONNX Runtime Web 1.20.1 | Runs the model in the browser | MIT | jsDelivr CDN |
| pdf-lib 1.17.1 | Image-to-PDF | MIT | jsDelivr CDN |
| qrcode (node-qrcode) 1.5.3 | QR generation | MIT | jsDelivr CDN |
| heic2any 0.0.4 | HEIC to JPG/PNG | MIT (bundles libheif and libde265, LGPL-3.0) | cdnjs CDN |
| Inter, Instrument Serif, Kantumruy Pro | Fonts | SIL OFL 1.1 | Google Fonts |

Services (not code we ship): Stripe (payments), your chosen hosting and email providers.

## To do before release
- [ ] Confirm each license text/version above against the upstream repos and add their copyright lines.
- [ ] Add the Apache-2.0 text for the model (included in `models/`) plus the upstream copyright/NOTICE if any.
- [ ] Run `npm run vendor` to self-host the libraries and fonts (see README). Keep their license headers intact and copy each package's LICENSE file into `vendor/` and `fonts/`.
