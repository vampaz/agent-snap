import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function syncExtensionVersion() {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, 'package.json');
  const manifestPath = path.join(rootDir, 'extension', 'manifest.json');

  const packageJson = readJson(packageJsonPath);
  const manifestJson = readJson(manifestPath);

  if (!packageJson.version) {
    throw new Error('package.json is missing version');
  }

  if (manifestJson.version === packageJson.version) {
    return;
  }

  const nextManifest = {
    ...manifestJson,
    version: packageJson.version,
  };

  writeJson(manifestPath, nextManifest);
}

syncExtensionVersion();
