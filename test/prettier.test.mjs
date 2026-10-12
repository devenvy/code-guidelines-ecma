import path from 'node:path';

import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import angular from '../src/prettier/angular.mjs';
import base from '../src/prettier/index.mjs';

const configFile = (name) => path.resolve(import.meta.dirname, `../src/prettier/${name}.mjs`);

/** Resolves options the way the Prettier CLI does, so `overrides` apply. */
async function formatAs(source, filepath, name) {
  const options = await resolveConfig(filepath, { config: configFile(name) });
  return format(source, { ...options, filepath });
}

describe('prettier config', () => {
  it('base has the agreed options and nothing else', () => {
    expect(base).toEqual({
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'all',
      endOfLine: 'lf',
    });
  });

  it('angular config is the base plus the html parser override', () => {
    expect(angular).toEqual({
      ...base,
      overrides: [{ files: '*.html', options: { parser: 'angular' } }],
    });
  });

  it('formats a suffixless Angular template with control flow', async () => {
    const source = '<div>@if (user()) {<p>{{user().name}}</p>} @else {<p>none</p>}</div>\n';
    const output = await formatAs(source, 'src/app/user-profile.html', 'angular');
    expect(output).toBe(
      [
        '<div>',
        '  @if (user()) {',
        '    <p>{{ user().name }}</p>',
        '  } @else {',
        '    <p>none</p>',
        '  }',
        '</div>',
        '',
      ].join('\n'),
    );
  });

  it('base config does not apply the Angular parser to plain html', async () => {
    const source = '<div>@if (x) {<p>a</p>}</div>\n';
    const output = await formatAs(source, 'index.html', 'index');
    expect(output).not.toContain('    <p>a</p>');
  });
});
