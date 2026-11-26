// Skylark Run hand-in: gathers the game and its screenshots into the output
// folder and writes the dossier the judges read. Runs on Node 22+ with only
// the standard library. The grader runs it twice and expects identical bytes.
//
// Usage outside the grader container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function freshDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

freshDir(destination);
copyTree(join(repoRoot, 'game'), join(destination, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(destination, 'screenshots'));

// Caps match the gate: at most 4 screenshots of 256 KiB, game/ within its
// file and size limits, and the dossier text capped at 160 KiB.
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
