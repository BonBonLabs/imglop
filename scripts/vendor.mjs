// Self-host all third-party libraries and fonts so visitors never contact a CDN or Google.
// Usage:  npm install && npm run vendor
// It copies files from node_modules into public/vendor and public/fonts, then points public/index.html at them.
// Safe to re-run. It stops with a clear message if anything it expects is missing.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const site = path.join(root, 'public'); // the folder Cloudflare publishes
const nm = path.join(root, process.env.VENDOR_NM || 'node_modules');
const fail = m => { console.error('\n✖ ' + m + '\n'); process.exit(1); };
const need = p => fs.existsSync(p) || fail('Missing ' + path.relative(root, p) + '. Run "npm install" first (and check the package version).');
const copy = (from, to) => { need(from); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

// 1) JavaScript libraries
// Each entry: [files to look for in node_modules (first one found wins), exact CDN file the site uses today (fallback), destination]
// Some npm packages do not ship their browser build, so when no local file exists we download the very same file the site loads today.
const CDN_FIX = u => process.env.VENDOR_TEST_BASE ? u.replace(/^https:\/\/[^/]+/, process.env.VENDOR_TEST_BASE) : u;
const libs = [
  [['pdf-lib/dist/pdf-lib.min.js', 'pdf-lib/dist/pdf-lib.js'], 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', 'vendor/pdf-lib.min.js'],
  [['qrcode/build/qrcode.min.js', 'qrcode/build/qrcode.js'], 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js', 'vendor/qrcode.min.js', { entry: 'qrcode/lib/browser.js', global: 'QRCode', must: 'toCanvas' }],
  [['heic2any/dist/heic2any.min.js', 'heic2any/dist/heic2any.js'], 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js', 'vendor/heic2any.min.js'],
  [['onnxruntime-web/dist/ort.min.js', 'onnxruntime-web/dist/ort.js'], 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js', 'vendor/ort/ort.min.js'],
];
// The qrcode 1.5.3 npm package ships no ready-made browser file (and the CDN has none either), so we build one from its source.
function bundle(entry, dest, globalName, must) {
  const [cmd, pre] = process.env.VENDOR_ESBUILD ? [process.env.VENDOR_ESBUILD, []] : ['npx', ['--yes', 'esbuild@0.24.0']];
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync(cmd, [...pre, entry, '--bundle', '--minify', '--format=iife', '--global-name=' + globalName, '--platform=browser', '--outfile=' + dest], { stdio: 'inherit' });
  const ctx = { window: {}, self: {}, document: {}, navigator: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(dest, 'utf8'), ctx);
  if (!ctx[globalName] || typeof ctx[globalName][must] !== 'function') fail('The built ' + globalName + ' file does not provide ' + must + '()');
}
for (const [cands, url, to, bundleCfg] of libs) {
  const found = cands.map(c => path.join(nm, c)).find(f => fs.existsSync(f));
  const dest = path.join(site, to);
  if (found) {
    copy(found, dest);
    console.log('  ' + path.relative(root, found) + '  ->  public/' + to);
  } else if (bundleCfg && fs.existsSync(path.join(nm, bundleCfg.entry))) {
    bundle(path.join(nm, bundleCfg.entry), dest, bundleCfg.global, bundleCfg.must);
    console.log('  built ' + bundleCfg.entry + '  ->  public/' + to + ' (' + Math.round(fs.statSync(dest).size / 1024) + ' KB)');
  } else {
    const res = await fetch(CDN_FIX(url));
    if (!res.ok) fail('Could not find ' + cands[0] + ' and downloading ' + url + ' failed (HTTP ' + res.status + ')');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) fail('Downloaded file from ' + url + ' looks too small (' + buf.length + ' bytes)');
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf);
    console.log('  downloaded ' + url + '  ->  public/' + to + ' (' + Math.round(buf.length / 1024) + ' KB)');
  }
}

// ONNX Runtime WebAssembly files (skip the big GPU/JSEP builds; this site uses the plain "wasm" provider)
const ortDist = path.join(nm, 'onnxruntime-web/dist');
need(ortDist);
let wasmCount = 0;
for (const f of fs.readdirSync(ortDist)) {
  if (!/^ort-wasm.*\.(wasm|mjs)$/.test(f) || /jsep|asyncify|webgpu/i.test(f)) continue;
  copy(path.join(ortDist, f), path.join(site, 'vendor/ort', f)); wasmCount++;
  const mb = fs.statSync(path.join(ortDist, f)).size / 1048576;
  if (mb > 24) console.warn('⚠ ' + f + ' is ' + mb.toFixed(1) + ' MB (Cloudflare Pages limit is 25 MB per file)');
}
if (!wasmCount) fail('No ONNX Runtime .wasm files found in ' + ortDist);

// 2) Fonts (Latin + Khmer subsets only, to keep the download small)
const fonts = [
  ['inter', ['400', '500', '600', '700', '800'], ['latin']],
  ['instrument-serif', ['400', '400-italic'], ['latin']],
  ['kantumruy-pro', ['600', '700'], ['latin', 'khmer']],
];
let css = '/* Generated by scripts/vendor.mjs. Fonts: Inter, Instrument Serif, Kantumruy Pro (SIL Open Font License 1.1) */\n';
for (const [pkg, variants, subsets] of fonts) {
  const base = path.join(nm, '@fontsource', pkg);
  for (const v of variants) {
    const cssFile = path.join(base, v + '.css'); need(cssFile);
    const blocks = fs.readFileSync(cssFile, 'utf8').match(/@font-face\s*\{[^}]*\}/g) || [];
    let kept = 0;
    for (const b of blocks) {
      if (!subsets.some(s => new RegExp('-' + s + '-\\d+-(normal|italic)\\.woff2').test(b))) continue;
      const m = b.match(/url\(\.?\/?(files\/[^)]+?\.woff2)\)/); if (!m) continue;
      copy(path.join(base, m[1]), path.join(site, 'fonts', m[1]));
      css += b.replace(/src:[^;]*;/, 'src: url(./' + m[1] + ') format("woff2");').replace(/\s*\n\s*/g, ' ') + '\n'; kept++;
    }
    if (!kept) fail('No matching font files found in ' + path.relative(root, cssFile));
  }
}
fs.mkdirSync(path.join(site, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(site, 'fonts/fonts.css'), css);

// 3) Point index.html at the local copies
const file = path.join(site, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const sub = (re, to, label) => { const n = html; html = html.replace(re, to); if (n === html && !html.includes(to)) fail('Could not update ' + label + ' in index.html'); };
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.g[^>]*>\s*/g, '');
sub(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/, '<link rel="stylesheet" href="./fonts/fonts.css">', 'font stylesheet');
sub(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/heic2any\/0\.0\.4\/heic2any\.min\.js/, './vendor/heic2any.min.js', 'heic2any');
sub(/https:\/\/cdn\.jsdelivr\.net\/npm\/pdf-lib@1\.17\.1\/dist\/pdf-lib\.min\.js/, './vendor/pdf-lib.min.js', 'pdf-lib');
sub(/https:\/\/cdn\.jsdelivr\.net\/npm\/qrcode@1\.5\.3\/build\/qrcode\.min\.js/, './vendor/qrcode.min.js', 'qrcode');
sub(/https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@1\.20\.1\/dist\//, './vendor/ort/', 'ONNX Runtime');
fs.writeFileSync(file, html);

const left = html.match(/https?:\/\/(fonts\.g|cdn\.jsdelivr|cdnjs)[^"'\s)]*/g);
console.log('✔ Done. Libraries in vendor/, fonts in fonts/. index.html now loads everything from your own site.');
if (left) console.warn('⚠ External references still present: ' + [...new Set(left)].join(', '));
