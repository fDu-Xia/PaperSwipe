// Generate a local-assets app; never copy credentials, user data or the repo.
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'www');
const source = path.join(root, '..', 'web');
const api = new URL(process.env.PAPERSWIPE_API_ORIGIN || 'https://paperswipe.site');
if (api.protocol !== 'https:' || api.pathname !== '/' || api.username || api.password || api.search || api.hash) {
  throw new Error('PAPERSWIPE_API_ORIGIN must be an HTTPS origin without a path or credentials');
}
await mkdir(output, {recursive: true});
await cp(source, output, {recursive: true});
const icons = path.join(root, 'android/app/src/main/res/drawable-nodpi');
await mkdir(icons, {recursive:true});
await cp(path.join(source, 'assets/paperswipe-logo.png'), path.join(icons, 'product_logo.png'));
await build({entryPoints: [path.join(root, 'native-entry.js')], bundle: true, format: 'iife',
  outfile: path.join(output, 'native.js'), define: {PAPERSWIPE_API_ORIGIN: JSON.stringify(api.origin)}});
for (const name of ['index.html', 'login.html']) {
  const html = await readFile(path.join(source, name), 'utf8');
  if (!html.includes('<head>') || !html.includes('<script src="/platform.js">')) {
    throw new Error(`${name} must have an explicit head for the native bridge and a platform script`);
  }
  await writeFile(path.join(output, name), html.replace('<script src="/platform.js">', '<script src="/native.js"></script>\n<script src="/platform.js">'));
}
console.log(`Bundled shared UI for ${api.origin}; no server changes made.`);
