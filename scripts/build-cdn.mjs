/**
 * The CDN build: one module a page imports from a script tag, aparté inside it, so a page
 * with no build step loads one file and its stylesheet — the way n8n's own widget is embedded.
 * What only some pages need stays in chunks beside it, fetched when used: a language other
 * than English, the highlighter with the first code block.
 *
 * esbuild rather than Vite's library mode: measured on the same entry, Vite's output was
 * 163 KB brotli for the first load and esbuild's 99 KB.
 */
import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(pkg, 'dist/cdn');
rmSync(outdir, { recursive: true, force: true });
await build({
    entryPoints: { 'n8n-chat': resolve(pkg, 'src/index.ts') },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: true,
    chunkNames: 'chunks/[name]-[hash]',
    logLevel: 'warning',
});
console.log('[n8n-chat] dist/cdn/n8n-chat.js, aparté inside');
