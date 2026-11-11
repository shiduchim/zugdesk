// Builds dist/ZivugMatch-Filing-Lab.html: one file with everything inside.
// usage: node tools/build_standalone.mjs <path to node_modules containing @mlc-ai/web-llm and esbuild>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const nodeModules = process.argv[2];
const esbuild = createRequire(path.join(nodeModules, 'x.js'))('esbuild');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsonl = p => read(p).trim().split('\n').map(l => { const r = JSON.parse(l); return { id: r.id, ir: r.ir, ms: r.ms, error: r.error }; });
const data = `export const WORLD = ${read('web/world.json')};
export const DEV = ${read('web/cases.json')};
export const HOLD = ${read('web/holdout.json')};
export const SAVED = { dev: ${JSON.stringify(jsonl('bench/results/C-rules.jsonl'))}, holdout: ${JSON.stringify(jsonl('bench/results/C-rules-holdout.jsonl'))} };
`;
fs.writeFileSync(path.join(root, 'web/js/data.js'), data);
const out = await esbuild.build({ entryPoints: [path.join(root, 'web/js/standalone.js')], bundle: true, format: 'esm', minify: true,
  write: false, nodePaths: [nodeModules], target: ['chrome113', 'edge113', 'firefox121', 'safari17'], legalComments: 'inline', logLevel: 'warning' });
let js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let css = read('web/style.css').replace(/^:root \{[\s\S]*?\n\}\n@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/, '') + '\n' + read('web/standalone.extra.css');
const html = read('web/standalone.template.html').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist/ZivugMatch-Filing-Lab.html');
fs.writeFileSync(dest, html);
console.log(`wrote ${dest} (${(html.length / 1e6).toFixed(2)} MB)`);
