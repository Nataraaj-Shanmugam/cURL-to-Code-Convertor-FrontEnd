/**
 * Build config for perf runs: the app's own vite.config.ts plus
 *  - outDir dist-perf (never touches dist/),
 *  - a plugin that records the rendered size of every source module per chunk (perf/results/modules.json),
 *  - PERF_PROFILE=1: unminified + sourcemaps, so CPU profiles can be mapped back to src/ files.
 * Use `--mode perf`: the env guard only blocks loopback API URLs in production/preprod modes, and the
 * bundle is otherwise the production one (minified, tree-shaken, same chunking).
 */
import { mergeConfig, defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import base from '../vite.config';

const profile = process.env.PERF_PROFILE === '1';

function moduleSizes(): Plugin {
  return {
    name: 'perf:module-sizes',
    apply: 'build',
    generateBundle(_o, bundle) {
      const out: Record<string, { file: string; renderedKB: number; modules: [string, number][] }> = {};
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const mods = Object.entries(chunk.modules)
          .map(([id, m]) => [id.replace(/^.*\/(node_modules|src)\//, (_s, d: string) => `${d}/`), m.renderedLength] as [string, number])
          .sort((a, b) => b[1] - a[1]);
        out[chunk.name] = { file, renderedKB: Math.round(mods.reduce((s, m) => s + m[1], 0) / 10.24) / 100, modules: mods.slice(0, 25) };
      }
      mkdirSync(resolve(__dirname, 'results'), { recursive: true });
      writeFileSync(resolve(__dirname, 'results', profile ? 'modules-profile.json' : 'modules.json'), JSON.stringify(out, null, 2));
    },
  };
}

export default mergeConfig(
  base,
  defineConfig({
    plugins: [moduleSizes()],
    server: { open: false },
    preview: { open: false },
    build: {
      outDir: profile ? 'dist-perf-profile' : 'dist-perf',
      emptyOutDir: true,
      ...(profile ? { minify: false, sourcemap: true } : {}),
    },
  }),
);
