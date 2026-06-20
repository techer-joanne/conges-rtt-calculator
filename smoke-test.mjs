// Smoke test sans navigateur : rend tout l'arbre React en HTML statique
// (react-dom/server) et vérifie que le calcul atteint bien l'interface.
import { build } from 'esbuild';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync, rmSync } from 'node:fs';

// Entrée placée DANS le projet pour que la résolution de node_modules marche.
const entry = join(process.cwd(), `__ssr-entry.tsx`);
writeFileSync(
  entry,
  `import React from 'react';
   import { renderToStaticMarkup } from 'react-dom/server';
   import App from './src/App';
   export const html = renderToStaticMarkup(React.createElement(App));
  `,
);

const out = join(process.cwd(), `__ssr-out.mjs`);
await build({
  entryPoints: [entry],
  outfile: out,
  format: 'esm',
  bundle: true,
  platform: 'node',
  jsx: 'automatic',
  packages: 'external', // react / react-dom résolus à l'exécution par node
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  logLevel: 'silent',
});

const { html } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true });
rmSync(out, { force: true });

const must = [
  'Calculateur de congés annuels',
  'Direction des Ressources Humaines',
  'Saisie',
  'Résultats',
  'Total congés + RTT',
  'Départ de l', // entrée de la sidebar (apostrophe échappée en &#x27; par React)
  '100,0 %', // prorata année pleine (exemple Excel)
  '43', // total CA + RTT (exemple Excel)
  'Imprimer / PDF',
];

let ok = true;
for (const token of must) {
  const found = html.includes(token);
  if (!found) ok = false;
  console.log(`${found ? '✅' : '❌'} contient « ${token} »`);
}
console.log(`\nTaille HTML rendu : ${html.length} caractères`);
process.exit(ok ? 0 : 1);
