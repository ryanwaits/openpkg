// utils/cache.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.cache');

function getCacheKey(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

export function cacheSpec(key: string, spec: any): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cacheKey = getCacheKey(key);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(spec, null, 2));
}

export function getCachedSpec(key: string): any | null {
  const cacheKey = getCacheKey(key);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Cache corrupted, return null
      return null;
    }
  }
  
  return null;
}

export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    });
  }
}