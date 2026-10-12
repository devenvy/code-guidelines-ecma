import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BLOCK_END, BLOCK_START, extractBlock, upsertBlock } from '../src/cli/lib/blocks.mjs';
import { diffJson, mergeJson } from '../src/cli/lib/json.mjs';
import { detectPackageManager, installCommand } from '../src/cli/lib/project.mjs';
import { detectEol, lineDiff, toLf } from '../src/cli/lib/text.mjs';

const block = (content) => `${BLOCK_START}\n${content}${BLOCK_END}\n`;

describe('managed blocks', () => {
  it('creates a block in an empty file', () => {
    expect(upsertBlock('', 'a\n', { position: 'start' })).toBe(block('a\n'));
  });

  it('puts a new block first, keeping existing content after it', () => {
    expect(upsertBlock('[*.cs]\nindent_size = 4\n', 'a\n', { position: 'start' })).toBe(
      `${block('a\n')}\n[*.cs]\nindent_size = 4\n`,
    );
  });

  it('places a new block after a matching line', () => {
    const text = 'root = true\n\n[*.cs]\nindent_size = 4\n';
    expect(upsertBlock(text, 'a\n', { position: 'start', after: /^root\s*=.*$/m })).toBe(
      `root = true\n\n${block('a\n')}\n[*.cs]\nindent_size = 4\n`,
    );
  });

  it('replaces an existing block in place and preserves surrounding content', () => {
    const text = `before\n${block('old\n')}after\n`;
    expect(upsertBlock(text, 'new\n', { position: 'start' })).toBe(
      `before\n${block('new\n')}after\n`,
    );
  });

  it('appends at the end when asked', () => {
    expect(upsertBlock('x\n', 'a\n', { position: 'end' })).toBe(`x\n\n${block('a\n')}`);
  });

  it('refuses a file with only one of the two markers', () => {
    expect(() => upsertBlock(`${BLOCK_START}\nx\n`, 'a\n', { position: 'start' }, '.x')).toThrow(
      '.x has an incomplete',
    );
    expect(() => upsertBlock(`x\n${BLOCK_END}\n`, 'a\n', { position: 'start' })).toThrow(
      'incomplete',
    );
  });

  it('extracts block content or null', () => {
    expect(extractBlock(`x\n${block('a\nb\n')}`)).toBe('a\nb\n');
    expect(extractBlock('x\n')).toBeNull();
  });
});

describe('managed json', () => {
  it('merges recommendations by presence and keeps comments and other entries', () => {
    const text = '{\n  // team picks\n  "recommendations": ["angular.ng-template", "foo.bar"]\n}\n';
    const result = mergeJson(text, [
      { path: ['recommendations'], includes: ['angular.ng-template', 'esbenp.prettier-vscode'] },
    ]);
    expect(result).toContain('// team picks');
    expect(result).toContain('"foo.bar"');
    expect(result).toContain('"esbenp.prettier-vscode"');
    expect(
      diffJson(result, [{ path: ['recommendations'], includes: ['esbenp.prettier-vscode'] }]),
    ).toEqual([]);
  });

  it('merges nested sub-keys without replacing siblings', () => {
    const text = '{\n  "editor.codeActionsOnSave": { "source.fixAll.stylelint": "explicit" }\n}\n';
    const result = mergeJson(text, [
      { path: ['editor.codeActionsOnSave', 'source.fixAll.eslint'], value: 'explicit' },
    ]);
    expect(JSON.parse(result)['editor.codeActionsOnSave']).toEqual({
      'source.fixAll.stylelint': 'explicit',
      'source.fixAll.eslint': 'explicit',
    });
  });

  it('creates a file from nothing', () => {
    expect(JSON.parse(mergeJson('', [{ path: ['a'], value: 1 }]))).toEqual({ a: 1 });
  });

  it('is idempotent', () => {
    const entries = [
      { path: ['a'], value: true },
      { path: ['list'], includes: ['x'] },
    ];
    const once = mergeJson('{}', entries);
    expect(mergeJson(once, entries)).toBe(once);
  });

  it('reports differences', () => {
    expect(diffJson('{"a": false}', [{ path: ['a'], value: true }])).toEqual([
      'a should be true (found false)',
    ]);
  });

  it('keeps tab indentation', () => {
    const result = mergeJson('{\n\t"x": 1\n}\n', [{ path: ['y'], value: 2 }]);
    expect(result).toContain('\t"y": 2');
  });
});

describe('package manager detection', () => {
  it.each([
    ['pnpm-lock.yaml', 'pnpm', 'pnpm add -D a b'],
    ['yarn.lock', 'yarn', 'yarn add -D a b'],
    ['bun.lock', 'bun', 'bun add -d a b'],
    ['package-lock.json', 'npm', 'npm i -D a b'],
  ])('%s → %s', (lockfile, manager, command) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cg-pm-'));
    try {
      writeFileSync(path.join(dir, lockfile), '');
      expect(detectPackageManager(dir)).toBe(manager);
      expect(installCommand(manager, ['a', 'b'])).toBe(command);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('text helpers', () => {
  it('detects and normalises line endings', () => {
    expect(detectEol('a\r\nb')).toBe('\r\n');
    expect(detectEol('a\nb')).toBe('\n');
    expect(toLf('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('diffs lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toBe('  a\n- b\n+ x\n  c');
  });
});
