import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.EXT_UPLOAD_PUBLIC_KEY || '';
const contents = `globalThis.__agentSnapUploadKey = ${JSON.stringify(apiKey)};\n`;
const targetPath = path.join(process.cwd(), 'extension', 'config.js');

fs.writeFileSync(targetPath, contents, 'utf8');
