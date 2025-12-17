import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let loaded = false;
const preservedKeys = new Set(Object.keys(process.env));

const readEnvFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
};

export const loadEnv = ({ rootDir = process.cwd(), mode = process.env.NODE_ENV } = {}) => {
  if (loaded) return;

  const files = ['.env', '.env.local'];
  const normalizedMode = (mode || '').trim();
  if (normalizedMode) {
    files.push(`.env.${normalizedMode}`, `.env.${normalizedMode}.local`);
  }

  for (const file of files) {
    const fullPath = path.resolve(rootDir, file);
    const raw = readEnvFile(fullPath);
    if (!raw) continue;
    const parsed = dotenv.parse(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (preservedKeys.has(key)) continue;
      process.env[key] = value;
    }
  }

  loaded = true;
};

