import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';

import type { AgentSnapSettings } from '@/types';

export type AgentSnapVitePluginOptions = {
  enabled?: boolean;
  endpoint?: string;
  projectRoot?: string;
  outputDir?: string;
  filename?: string;
  initialTheme?: 'dark' | 'light';
  settings?: Partial<AgentSnapSettings>;
};

export type AgentSnapSavePayload = {
  markdown?: unknown;
  pathname?: unknown;
  href?: unknown;
  title?: unknown;
};

export type AgentSnapSaveResult = {
  markdownPath: string;
  assets: string[];
  markdown: string;
};

type ResolvedAgentSnapVitePluginOptions = {
  endpoint: string;
  projectRoot?: string;
  outputDir: string;
  filename?: string;
  initialTheme: 'dark' | 'light';
  settings: Partial<AgentSnapSettings>;
};

type AssetManifest = {
  assets?: AssetManifestEntry[];
  actions?: AssetManifestAction[];
  assetDirectory?: string;
  imageOutputMode?: string;
};

type AssetManifestEntry = {
  id?: string;
  data?: string;
  url?: string;
  viewerUrl?: string;
  path?: string;
  filename?: string;
};

type AssetManifestAction = {
  type?: string;
  assetId?: string;
  outputPath?: string;
  strategy?: string;
  url?: string;
};

const DEFAULT_ENDPOINT = '/__agent_snap__/snap';
const DEFAULT_OUTPUT_DIR = 'agent-snapshots';
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const CLIENT_MODULE_ID = 'virtual:agent-snap/client';
const RESOLVED_CLIENT_MODULE_ID = `\0${CLIENT_MODULE_ID}`;
const FILE_AGENT_TIPS =
  'Images are saved on disk. Follow ref ids in the report to matching assets[].path entries.';

export default function agentSnap(options: AgentSnapVitePluginOptions = {}): Plugin {
  let config: ResolvedConfig | null = null;
  const resolved = resolveOptions(options);

  return {
    name: 'agent-snap:vite',
    apply: 'serve',
    configResolved: function configResolved(nextConfig) {
      config = nextConfig;
    },
    resolveId: function resolveId(source) {
      if (source === CLIENT_MODULE_ID) {
        return RESOLVED_CLIENT_MODULE_ID;
      }
      return null;
    },
    load: function load(id) {
      if (id === RESOLVED_CLIENT_MODULE_ID) {
        return buildClientCode(resolved);
      }
      return null;
    },
    configureServer: function configureServer(server) {
      if (options.enabled === false) return;
      server.middlewares.use(resolved.endpoint, function handleAgentSnapRequest(req, res, next) {
        if (req.method !== 'POST') {
          next();
          return;
        }

        handleSaveRequest(req, res, server, config, resolved).catch(next);
      });
    },
    transformIndexHtml: function transformIndexHtml() {
      if (options.enabled === false) return [];
      return [
        {
          tag: 'script',
          attrs: {
            type: 'module',
            src: buildClientModuleSrc(config?.base),
          },
          injectTo: 'body',
        },
      ];
    },
  };
}

export function buildClientModuleSrc(base: string | undefined): string {
  const normalizedBase = !base || base === './' ? '/' : base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}@id/__x00__${CLIENT_MODULE_ID}`;
}

export async function saveAgentSnapPayload(
  root: string,
  options: ResolvedAgentSnapVitePluginOptions,
  payload: AgentSnapSavePayload,
): Promise<AgentSnapSaveResult> {
  if (typeof payload.markdown !== 'string' || payload.markdown.trim().length === 0) {
    throw new Error('Agent Snap payload is missing markdown.');
  }

  const markdownFilename = resolveMarkdownFilename(options, payload.markdown);
  const markdownPath = resolveInsideRoot(root, path.join(options.outputDir, markdownFilename));
  const transportMarkdown = rewriteAssetManifestPaths(
    payload.markdown,
    root,
    path.dirname(markdownPath),
  );
  const assets = await materializeAssets(root, transportMarkdown);
  const markdown = rewriteSavedAssetManifest(transportMarkdown);

  await mkdir(path.dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, markdown, 'utf8');

  return {
    markdownPath: path.relative(root, markdownPath),
    assets: assets.map(function makeRelative(assetPath) {
      return path.relative(root, assetPath);
    }),
    markdown: markdown,
  };
}

export function resolveOptions(
  options: AgentSnapVitePluginOptions = {},
): ResolvedAgentSnapVitePluginOptions {
  return {
    endpoint: options.endpoint || DEFAULT_ENDPOINT,
    projectRoot: options.projectRoot,
    outputDir: options.outputDir || DEFAULT_OUTPUT_DIR,
    filename: options.filename,
    initialTheme: options.initialTheme || 'dark',
    settings: {
      uploadScreenshots: false,
      ...options.settings,
    },
  };
}

export function buildClientCode(options: ResolvedAgentSnapVitePluginOptions): string {
  const agentSnapOptions = JSON.stringify({
    initialTheme: options.initialTheme,
    settings: options.settings,
  });
  const endpoint = JSON.stringify(options.endpoint);

  return `
import { createAgentSnap } from 'agent-snap';

const key = '__agentSnapVitePlugin';
const previous = globalThis[key];

if (previous && typeof previous.destroy === 'function') {
  previous.destroy();
}

const instance = createAgentSnap({
  ...${agentSnapOptions},
  copyToClipboard: false,
  onCopy: async function onCopy(markdown) {
    try {
      const response = await fetch(${endpoint}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: markdown,
          pathname: window.location.pathname,
          href: window.location.href,
          title: document.title,
        }),
      });

      if (!response.ok) {
        console.warn('[agent-snap] Could not save snapshot to the Vite dev server.');
        return;
      }

      const result = await response.json();
      if (typeof result.markdown === 'string' && navigator.clipboard) {
        await navigator.clipboard.writeText(result.markdown);
      }
    } catch (error) {
      console.warn('[agent-snap] Could not save snapshot to the Vite dev server.', error);
    }
  },
});

instance.setSettings(${JSON.stringify(options.settings)});
globalThis[key] = instance;
`.trim();
}

async function handleSaveRequest(
  req: IncomingMessage,
  res: ServerResponse,
  server: ViteDevServer,
  config: ResolvedConfig | null,
  options: ResolvedAgentSnapVitePluginOptions,
): Promise<void> {
  try {
    const body = await readRequestBody(req);
    const payload = JSON.parse(body) as AgentSnapSavePayload;
    const viteRoot = config?.root || server.config.root;
    const result = await saveAgentSnapPayload(resolveSaveRoot(viteRoot, options), options, payload);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Agent Snap save error.';
    sendJson(res, message.includes('too large') ? 413 : 400, {
      ok: false,
      error: message,
    });
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise(function readBody(resolve, reject) {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on('data', function handleChunk(chunk: Buffer) {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('Agent Snap payload is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', function handleEnd() {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function materializeAssets(root: string, markdown: string): Promise<string[]> {
  const manifest = parseAssetManifest(markdown);
  if (!manifest || !manifest.assets || !manifest.actions) return [];

  const assets = new Map<string, AssetManifestEntry>();
  manifest.assets.forEach(function collectAsset(asset) {
    if (asset.id) {
      assets.set(asset.id, asset);
    }
  });

  const written: string[] = [];

  for (const action of manifest.actions) {
    if (action.type !== 'materialize-asset' || !action.assetId || !action.outputPath) {
      continue;
    }

    const asset = assets.get(action.assetId);
    const assetPath = resolveInsideRoot(root, action.outputPath);
    const content = await resolveAssetContent(action, asset);

    await mkdir(path.dirname(assetPath), { recursive: true });
    await writeFile(assetPath, content);
    written.push(assetPath);
  }

  return written;
}

async function resolveAssetContent(
  action: AssetManifestAction,
  asset: AssetManifestEntry | undefined,
): Promise<Buffer> {
  const assetId = action.assetId || 'unknown';

  if (action.strategy === 'base64' && asset?.data) {
    return Buffer.from(asset.data, 'base64');
  }

  if (action.strategy === 'url') {
    const url = action.url || asset?.url;
    if (!url) {
      throw new Error(`Agent Snap could not materialize asset "${assetId}" because it has no URL.`);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(
        `Agent Snap could not materialize asset "${assetId}" because its URL is invalid.`,
      );
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `Agent Snap could not materialize asset "${assetId}" because its URL protocol is unsupported.`,
      );
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Agent Snap could not materialize asset "${assetId}" because the URL returned ${response.status}.`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error(`Agent Snap could not materialize asset "${assetId}" because it has no data.`);
}

function parseAssetManifest(markdown: string): AssetManifest | null {
  const match = markdown.match(/```agent-snap-assets\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as AssetManifest;
  } catch {
    return null;
  }
}

function rewriteAssetManifestPaths(markdown: string, root: string, assetBaseDir: string): string {
  const match = markdown.match(/```agent-snap-assets\s*([\s\S]*?)\s*```/);
  if (!match) return markdown;

  let manifest: AssetManifest;
  try {
    manifest = JSON.parse(match[1]) as AssetManifest;
  } catch {
    return markdown;
  }

  if (!manifest.actions || manifest.actions.length === 0) return markdown;

  const nextManifest = {
    ...manifest,
    assetDirectory: toProjectRelativePath(root, assetBaseDir),
    actions: manifest.actions.map(function rewriteAction(action) {
      if (action.type !== 'materialize-asset' || !action.outputPath) {
        return action;
      }
      return {
        ...action,
        outputPath: resolveProjectOutputPath(root, assetBaseDir, action.outputPath),
      };
    }),
  };

  return markdown.replace(
    match[0],
    `\`\`\`agent-snap-assets\n${JSON.stringify(nextManifest, null, 2)}\n\`\`\``,
  );
}

function resolveProjectOutputPath(root: string, assetBaseDir: string, outputPath: string): string {
  const normalizedOutputPath = outputPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalizedOutputPath.startsWith('../') || path.isAbsolute(outputPath)) {
    return toProjectRelativePath(root, outputPath);
  }
  const sourceFilename = path.basename(normalizedOutputPath);
  return toProjectRelativePath(root, path.join(assetBaseDir, sourceFilename));
}

function rewriteSavedAssetManifest(markdown: string): string {
  const match = markdown.match(/```agent-snap-assets\s*([\s\S]*?)\s*```/);
  if (!match) return markdown;

  let manifest: AssetManifest;
  try {
    manifest = JSON.parse(match[1]) as AssetManifest;
  } catch {
    return markdown;
  }

  const pathsByAssetId = new Map<string, string>();
  manifest.actions?.forEach(function collectPath(action) {
    if (action.type === 'materialize-asset' && action.assetId && action.outputPath) {
      pathsByAssetId.set(action.assetId, action.outputPath);
    }
  });

  const nextManifest: AssetManifest = {
    ...manifest,
    imageOutputMode: 'file',
    assets: manifest.assets?.map(function stripEmbeddedAsset(asset) {
      const nextAsset = {
        ...asset,
        path: asset.path || (asset.id ? pathsByAssetId.get(asset.id) : undefined),
      };
      delete nextAsset.data;
      delete nextAsset.url;
      delete nextAsset.viewerUrl;
      return nextAsset;
    }),
    actions: undefined,
  };

  const nextMarkdown = markdown.replace(
    match[0],
    `\`\`\`agent-snap-assets\n${JSON.stringify(nextManifest, null, 2)}\n\`\`\``,
  );

  return rewriteAgentTips(nextMarkdown, FILE_AGENT_TIPS);
}

function rewriteAgentTips(markdown: string, tips: string): string {
  const nextTips = `**Agent Tips:** ${tips}`;
  if (markdown.match(/\*\*Agent Tips:\*\* .*(?:\n|$)/)) {
    return markdown.replace(/\*\*Agent Tips:\*\* .*(?:\n|$)/, `${nextTips}\n`);
  }
  return `${markdown.trim()}\n\n${nextTips}`;
}

function resolveMarkdownFilename(
  options: ResolvedAgentSnapVitePluginOptions,
  markdown: string,
): string {
  if (options.filename) {
    return options.filename;
  }
  const assetFilename = resolvePrimaryAssetFilename(markdown);
  if (assetFilename) {
    return `${path.basename(assetFilename, path.extname(assetFilename))}.md`;
  }
  return `agent-snap-${formatSnapshotTimestamp(new Date())}.md`;
}

function resolvePrimaryAssetFilename(markdown: string): string | null {
  const manifest = parseAssetManifest(markdown);
  if (!manifest || !manifest.assets || manifest.assets.length === 0) return null;

  const primaryAsset =
    manifest.assets.find(function findScreenshot(asset) {
      return asset.id?.includes('screenshot') || asset.path?.includes('screenshot');
    }) || manifest.assets[0];

  const action = manifest.actions?.find(function findAction(nextAction) {
    return (
      nextAction.type === 'materialize-asset' &&
      Boolean(nextAction.outputPath) &&
      nextAction.assetId === primaryAsset.id
    );
  });

  return path.basename(action?.outputPath || primaryAsset.path || primaryAsset.filename || '');
}

function formatSnapshotTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveSaveRoot(viteRoot: string, options: ResolvedAgentSnapVitePluginOptions): string {
  if (!options.projectRoot) {
    return path.resolve(viteRoot);
  }
  return path.resolve(viteRoot, options.projectRoot);
}

function toProjectRelativePath(root: string, target: string): string {
  const absolutePath = resolveInsideRoot(root, target);
  return `./${path.relative(path.resolve(root), absolutePath).replace(/\\/g, '/')}`;
}

function resolveInsideRoot(root: string, target: string): string {
  const rootPath = path.resolve(root);
  const targetPath = path.resolve(rootPath, target);
  const relative = path.relative(rootPath, targetPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Agent Snap can only write files inside the configured project root.');
  }

  return targetPath;
}
