import { readFile } from 'node:fs/promises';

export async function readTrimmed(path: string): Promise<string> {
  const text = await readFile(path, 'utf8');
  return text.trim();
}
