import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when this module is the script Node was started with. Tolerates a missing ".js"
 * (`nest start` runs `node dist/main`, not `dist/main.js`).
 */
export function isEntrypoint(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  const strip = (p: string) => p.replace(/\.js$/, '');
  return strip(fileURLToPath(moduleUrl)) === strip(resolve(process.argv[1]));
}
