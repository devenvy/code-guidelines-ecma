import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatWritten } from '../src/cli/lib/format.mjs';

/** @type {string[]} */
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A project inside this repo, so Prettier resolves from the repo's node_modules. */
function projectWithPrettier() {
  const base = path.resolve(import.meta.dirname, '.tmp');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(path.join(base, 'format-'));
  dirs.push(dir);
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'x', prettier: { singleQuote: true } }),
  );
  return dir;
}

describe('formatWritten', () => {
  it('formats written files with the project prettier config', async () => {
    const dir = projectWithPrettier();
    writeFileSync(path.join(dir, 'a.json'), '{"list":[\n"a",\n"b"\n]}');
    writeFileSync(path.join(dir, 'b.mjs'), 'export const x = "y"\n');
    await formatWritten(dir, ['a.json', 'b.mjs']);
    expect(readFileSync(path.join(dir, 'a.json'), 'utf8')).toBe('{ "list": ["a", "b"] }\n');
    expect(readFileSync(path.join(dir, 'b.mjs'), 'utf8')).toBe("export const x = 'y';\n");
  });

  it('leaves ignored files and files Prettier cannot parse untouched', async () => {
    const dir = projectWithPrettier();
    writeFileSync(path.join(dir, '.prettierignore'), 'ignored.json\n');
    writeFileSync(path.join(dir, 'ignored.json'), '{"a":1}');
    writeFileSync(path.join(dir, '.editorconfig'), 'root=true');
    await formatWritten(dir, ['ignored.json', '.editorconfig']);
    expect(readFileSync(path.join(dir, 'ignored.json'), 'utf8')).toBe('{"a":1}');
    expect(readFileSync(path.join(dir, '.editorconfig'), 'utf8')).toBe('root=true');
  });

  it('returns a warning instead of throwing when the Prettier config cannot be resolved', async () => {
    const dir = projectWithPrettier();
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'x', prettier: '@devenvy/not-installed/prettier' }),
    );
    writeFileSync(path.join(dir, 'a.json'), '{"a":1}');
    expect(await formatWritten(dir, ['a.json'])).toEqual([
      'Could not format a.json with Prettier; run: prettier --write .',
    ]);
    expect(readFileSync(path.join(dir, 'a.json'), 'utf8')).toBe('{"a":1}');
  });

  it('does nothing when the project has no Prettier installed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cg-noprettier-'));
    dirs.push(dir);
    writeFileSync(path.join(dir, 'package.json'), '{}');
    writeFileSync(path.join(dir, 'a.json'), '{"a":1}');
    await formatWritten(dir, ['a.json']);
    expect(readFileSync(path.join(dir, 'a.json'), 'utf8')).toBe('{"a":1}');
  });
});
