import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', 'electron', 'data');

const communes = require('@etalab/decoupage-administratif/data/communes.json');
const departements = require('@etalab/decoupage-administratif/data/departements.json');

const d = {};
for (const dep of departements) d[dep.code] = dep.nom;

const c = communes
  .filter((x) => x.type === 'commune-actuelle')
  .map((x) => [x.nom, x.codesPostaux || [], x.departement]);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'communes.json'), JSON.stringify({ d, c }));

console.log(`communes.json généré : ${c.length} communes, ${Object.keys(d).length} départements`);
