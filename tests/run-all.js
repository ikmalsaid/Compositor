// ─────────────────────────────────────────────────────────────────────────────
// tests/run-all.js  —  All-in-One CLI Test Runner & Diagnostic Suite
// ─────────────────────────────────────────────────────────────────────────────

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n🎨 Compositor Windows — Running Unit & Regression Test Suite...\n');

const testFiles = [
  path.join(__dirname, 'document.test.js'),
  path.join(__dirname, 'transform.test.js'),
  path.join(__dirname, 'session.test.js'),
  path.join(__dirname, 'ruler.test.js'),
  path.join(__dirname, 'project.test.js'),
  path.join(__dirname, 'adjustments.test.js'),
  path.join(__dirname, 'newCanvas.test.js'),
  path.join(__dirname, 'layerDialogs.test.js'),
  path.join(__dirname, 'cursorTool.test.js'),
  path.join(__dirname, 'mirrorFlip.test.js'),
  path.join(__dirname, 'blurPerformance.test.js'),
  path.join(__dirname, 'clipart.test.js'),
  path.join(__dirname, 'wordart.test.js'),
  path.join(__dirname, 'gradient.test.js'),
  path.join(__dirname, 'tabs.test.js'),
  path.join(__dirname, 'bucket.test.js'),
];

const stream = run({
  files: testFiles,
  concurrency: true,
});

stream.compose(new spec()).pipe(process.stdout);

stream.on('test:fail', () => {
  process.exitCode = 1;
});
