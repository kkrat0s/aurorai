import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { catalogSchema, emptyCatalog } from './catalog';
export async function loadCatalog() {
  try {
    return catalogSchema.parse(JSON.parse(await readFile(path.join(process.cwd(), '../../demo/fixtures/verified-sources.json'), 'utf8')));
  } catch (error) {
    console.error('Verified catalog unavailable', error instanceof Error ? error.message : 'Invalid file');
    return emptyCatalog('Verified source catalog is unavailable or failed schema validation. Run the acquisition script; no substitute readings are shown.');
  }
}
export async function loadEvaluation():Promise<Record<string,unknown>|null> {
  try {return JSON.parse(await readFile(path.join(process.cwd(),'../../demo/fixtures/learning-results.json'),'utf8'));}
  catch {return null;}
}
