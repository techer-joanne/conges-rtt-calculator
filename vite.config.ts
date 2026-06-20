import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' produit des chemins relatifs => le dist/index.html s'ouvre
// directement par double-clic (file://) sans serveur, et fonctionne aussi
// derrière n'importe quel sous-dossier (Vercel, intranet, etc.).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
