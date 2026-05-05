import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import agentSnap, {
  buildClientCode,
  buildClientModuleSrc,
  resolveOptions,
  saveAgentSnapPayload,
} from '@/vite';

let tempDirs: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-snap-vite-'));
  tempDirs.push(root);
  return root;
}

function createMarkdownWithAsset(): string {
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

function createMarkdownWithUrlAsset(): string {
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
            url: 'https://example.com/screenshot.jpg',
            filename: 'agent-snap-annotation-1-screenshot.jpg',
          },
        ],
        actions: [
          {
            type: 'materialize-asset',
            assetId: 'agent-snap-annotation-1-screenshot',
            outputPath: './agent-snap-downloads/agent-snap-annotation-1-screenshot.jpg',
            strategy: 'url',
            url: 'https://example.com/screenshot.jpg',
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

describe('agentSnap vite plugin', function () {
  afterEach(async function () {
    const dirs = tempDirs;
    tempDirs = [];
    await Promise.all(
      dirs.map(function removeTempDir(dir) {
        return rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it('creates a serve-only Vite plugin', function () {
    const plugin = agentSnap();

    expect(plugin.name).toBe('agent-snap:vite');
    expect(plugin.apply).toBe('serve');
    expect(typeof plugin.configureServer).toBe('function');
    expect(typeof plugin.transformIndexHtml).toBe('function');
  });

  it('injects the client with local asset uploads disabled by default', function () {
    const code = buildClientCode(resolveOptions());

    expect(code).toContain("import { createAgentSnap } from 'agent-snap'");
    expect(code).toContain('/__agent_snap__/snap');
    expect(code).toContain('"uploadScreenshots":false');
    expect(code).toContain('copyToClipboard: false');
    expect(code).toContain('instance.setSettings({"uploadScreenshots":false})');
    expect(code).toContain('fetch(');
    expect(code).toContain('navigator.clipboard.writeText(result.markdown)');
  });

  it('builds the injected client module URL from the Vite base', function () {
    expect(buildClientModuleSrc('/')).toBe('/@id/__x00__virtual:agent-snap/client');
    expect(buildClientModuleSrc('/agent-snap/')).toBe(
      '/agent-snap/@id/__x00__virtual:agent-snap/client',
    );
  });

  it('saves named markdown and materializes base64 assets next to it', async function () {
    const root = await createTempRoot();
    const options = resolveOptions();
    const result = await saveAgentSnapPayload(root, options, {
      markdown: createMarkdownWithAsset(),
    });

    expect(result.markdownPath).toBe('agent-snapshots/agent-snap-annotation-1-screenshot.md');
    expect(result.assets).toEqual(['agent-snapshots/agent-snap-annotation-1-screenshot.png']);

    const markdown = await readFile(path.join(root, result.markdownPath), 'utf8');
    const asset = await readFile(path.join(root, result.assets[0]), 'utf8');

    expect(markdown).toContain('## Page Feedback: /test');
    expect(markdown).toBe(result.markdown);
    expect(markdown).toContain('"imageOutputMode": "file"');
    expect(markdown).toContain('"assetDirectory": "./agent-snapshots"');
    expect(markdown).toContain(
      '"path": "./agent-snapshots/agent-snap-annotation-1-screenshot.png"',
    );
    expect(markdown).toContain('Images are saved on disk');
    expect(markdown).not.toContain('"data": "aGVsbG8="');
    expect(markdown).not.toContain('"actions"');
    expect(markdown).not.toContain('"outputPath"');
    expect(asset).toBe('hello');
  });

  it('downloads url assets into the project root', async function () {
    const root = await createTempRoot();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async function fetchUrlAsset() {
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]));
    } as typeof fetch;

    try {
      const result = await saveAgentSnapPayload(root, resolveOptions(), {
        markdown: createMarkdownWithUrlAsset(),
      });
      expect(result.assets).toEqual(['agent-snapshots/agent-snap-annotation-1-screenshot.jpg']);
      expect(result.markdownPath).toBe('agent-snapshots/agent-snap-annotation-1-screenshot.md');

      const asset = await readFile(path.join(root, result.assets[0]));
      const markdown = await readFile(path.join(root, result.markdownPath), 'utf8');

      expect(Array.from(asset)).toEqual([0xff, 0xd8, 0xff]);
      expect(markdown).toContain('"imageOutputMode": "file"');
      expect(markdown).toContain(
        '"path": "./agent-snapshots/agent-snap-annotation-1-screenshot.jpg"',
      );
      expect(markdown).not.toContain('https://example.com/screenshot.jpg');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects when a url asset cannot be downloaded', async function () {
    const root = await createTempRoot();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async function fetchUrlAsset() {
      return new Response(null, { status: 404 });
    } as typeof fetch;

    try {
      await expect(
        saveAgentSnapPayload(root, resolveOptions(), {
          markdown: createMarkdownWithUrlAsset(),
        }),
      ).rejects.toThrow('returned 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not write markdown when a referenced asset cannot be materialized', async function () {
    const root = await createTempRoot();
    const snapshotDir = path.join(root, 'agent-snapshots');
    const snapshotPath = path.join(snapshotDir, 'agent-snap-fixed.md');
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(snapshotPath, 'previous snapshot', 'utf8');

    await expect(
      saveAgentSnapPayload(
        root,
        resolveOptions({
          filename: 'agent-snap-fixed.md',
        }),
        {
          markdown: createMarkdownWithAsset().replace('"data": "aGVsbG8=",', ''),
        },
      ),
    ).rejects.toThrow('has no data');

    const snapshot = await readFile(snapshotPath, 'utf8');
    expect(snapshot).toBe('previous snapshot');
  });

  it('does not duplicate project-relative asset paths when resaving markdown', async function () {
    const root = await createTempRoot();
    const options = resolveOptions({
      filename: 'agent-snap-fixed.md',
    });
    const first = await saveAgentSnapPayload(root, options, {
      markdown: createMarkdownWithAsset(),
    });
    const markdown = await readFile(path.join(root, first.markdownPath), 'utf8');
    const second = await saveAgentSnapPayload(root, options, {
      markdown: markdown,
    });
    const resaved = await readFile(path.join(root, second.markdownPath), 'utf8');

    expect(second.assets).toEqual([]);
    expect(resaved).toContain('"path": "./agent-snapshots/agent-snap-annotation-1-screenshot.png"');
    expect(resaved).not.toContain('agent-snapshots/agent-snapshots');
    expect(resaved).not.toContain('"data"');
  });

  it('refuses markdown paths outside the project root', async function () {
    const root = await createTempRoot();

    await expect(
      saveAgentSnapPayload(
        root,
        resolveOptions({
          outputDir: '../outside',
        }),
        {
          markdown: '## Page Feedback',
        },
      ),
    ).rejects.toThrow('inside the configured project root');
  });

  it('refuses asset paths outside the project root', async function () {
    const root = await createTempRoot();
    const markdown = createMarkdownWithAsset().replace(
      './agent-snap-downloads/agent-snap-annotation-1-screenshot.png',
      '../outside.png',
    );

    await expect(
      saveAgentSnapPayload(root, resolveOptions(), {
        markdown: markdown,
      }),
    ).rejects.toThrow('inside the configured project root');

    expect(existsSync(path.join(root, '..', 'outside.png'))).toBe(false);
  });
});
