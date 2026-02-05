import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(contents) {
  const env = {};
  const lines = contents.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotes(rawValue);
    if (key) env[key] = value;
  }
  return env;
}

function stripQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env file at ${envPath}`);
  }
  return fs.readFileSync(envPath, 'utf8');
}

function buildExtensionWithEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envContents = readEnvFile(envPath);
  const fileEnv = parseEnvFile(envContents);
  const apiKey = fileEnv.EXT_UPLOAD_PUBLIC_KEY;
  if (!apiKey) {
    throw new Error('Missing EXT_UPLOAD_PUBLIC_KEY in .env');
  }

  const result = spawnSync('npm', ['run', 'build:ext'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXT_UPLOAD_PUBLIC_KEY: apiKey,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

buildExtensionWithEnv();
