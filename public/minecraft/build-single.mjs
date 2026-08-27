// Bundles the whole game into one standalone .html file you can download and
// open straight off your disk. Run:  node build-single.mjs [outfile]
// Opening the result from file:// gives real pointer-lock mouse capture, which
// embedded/sandboxed iframes refuse.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'BlockCraft.html');

const inlined = [];
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    inlined.push(src);
    return '<script>\n' + fs.readFileSync(path.join(here, src), 'utf8') + '\n</script>';
  });

fs.writeFileSync(out, html);
console.log(`${out}  (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${inlined.length} scripts inlined)`);
