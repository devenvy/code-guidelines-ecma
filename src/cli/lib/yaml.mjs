import { isMap, isScalar, parseDocument } from 'yaml';

import { CliError } from './errors.mjs';

/**
 * @param {string} text
 * @param {string} file for error messages
 */
function parse(text, file) {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    const [first = ''] = (doc.errors[0]?.message ?? '').split('\n');
    throw new CliError(`${file} is not valid YAML (${first}); fix it and re-run`);
  }
  if (doc.contents !== null && !isMap(doc.contents)) {
    throw new CliError(`${file} must be a YAML map; fix it and re-run`);
  }
  return doc;
}

/**
 * The `allowBuilds` map, `null` when absent or empty (`allowBuilds:` with no entries).
 * @param {import('yaml').Document} doc
 * @param {string} file
 */
function allowBuilds(doc, file) {
  const node = doc.get('allowBuilds', true);
  if (node === undefined || (isScalar(node) && node.value === null)) {
    return null;
  }
  if (!isMap(node)) {
    throw new CliError(`${file}: allowBuilds must map package names to true or false`);
  }
  return node;
}

/**
 * Packages in `names` whose build script pnpm-workspace.yaml leaves undecided. Only `true` and
 * `false` decide: pnpm writes a "set this to true or false" placeholder after a failed install.
 * Projects using pnpm's `permissions` setting (which takes precedence) decide there instead.
 * @param {string} text
 * @param {string[]} names
 * @param {string} file
 * @returns {string[]}
 */
export function undecidedBuilds(text, names, file) {
  const doc = parse(text, file);
  if (doc.has('permissions')) {
    return [];
  }
  const map = allowBuilds(doc, file);
  return names.filter((name) => typeof map?.get(name) !== 'boolean');
}

/**
 * Writes `decisions` for the packages pnpm-workspace.yaml leaves undecided, keeping every other
 * value, comment and line. Returns `text` unchanged when nothing is undecided.
 * @param {string} text
 * @param {Record<string, boolean>} decisions
 * @param {string} file
 * @returns {string}
 */
export function decideBuilds(text, decisions, file) {
  const undecided = undecidedBuilds(text, Object.keys(decisions), file);
  if (undecided.length === 0) {
    return text;
  }
  const doc = parse(text, file);
  if (allowBuilds(doc, file) === null) {
    // an empty `allowBuilds:` may still carry comments (e.g. commented-out entries)
    const empty = /** @type {import('yaml').Scalar | undefined} */ (doc.get('allowBuilds', true));
    const map = doc.createNode({});
    map.commentBefore = empty?.comment;
    doc.set('allowBuilds', map);
  }
  for (const name of undecided) {
    doc.setIn(['allowBuilds', name], decisions[name]);
  }
  // keep the user's formatting: no re-wrapped long values, no padding added inside [a, b]
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}
