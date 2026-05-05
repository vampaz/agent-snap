import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const distVitePath = path.join(repoRoot, 'dist', 'vite.mjs');
const distVite = await readFile(distVitePath, 'utf8');

assert.equal(
  distVite.includes('__vite-browser-external'),
  false,
  'dist/vite.mjs must not bundle Node built-ins as Vite browser externals.',
);
assert.match(distVite, /node:buffer/);
assert.match(distVite, /node:fs\/promises/);
assert.match(distVite, /node:path/);

const { resolveOptions, saveAgentSnapPayload } = await import('../dist/vite.mjs');
const root = await mkdtemp(path.join(os.tmpdir(), 'agent-snap-vite-dist-'));

try {
  const result = await saveAgentSnapPayload(root, resolveOptions(), {
    markdown: createMarkdownWithAsset(),
  });
  const markdown = await readFile(path.join(root, result.markdownPath), 'utf8');
  const asset = await readFile(path.join(root, result.assets[0]), 'utf8');

  assert.equal(result.markdownPath, 'agent-snapshots/agent-snap-annotation-1-screenshot.md');
  assert.deepEqual(result.assets, ['agent-snapshots/agent-snap-annotation-1-screenshot.png']);
  assert.equal(markdown, result.markdown);
  assert.equal(asset, 'hello');
  assert.match(markdown, /"imageOutputMode": "file"/);
  assert.match(markdown, /"path": "\.\/agent-snapshots\/agent-snap-annotation-1-screenshot\.png"/);
  assert.equal(markdown.includes('"data": "aGVsbG8="'), false);
  assert.equal(markdown.includes('"actions"'), false);
} finally {
  await rm(root, { recursive: true, force: true });
}

function createMarkdownWithAsset() {
  return [
    '## Page Feedback: /test',
    '',
    '```agent-snap-assets',
    JSON.stringify(
      {
        version: 1,
        assets: [
          {
            id: 'agent-snap-annotation-1-screenshot',
            data: 'aGVsbG8=',
            filename: 'agent-snap-annotation-1-screenshot.png',
          },
        ],
        actions: [
          {
            type: 'materialize-asset',
            assetId: 'agent-snap-annotation-1-screenshot',
            outputPath: './agent-snap-downloads/agent-snap-annotation-1-screenshot.png',
            strategy: 'base64',
          },
        ],
      },
      null,
      2,
    ),
    '```',
    '',
    '### 1. button',
  ].join('\n');
}
