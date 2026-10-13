/**
 * Rule tables record decisions. A rule a plugin ships that its table does not list (usually one
 * added in a newer plugin version) is on: `error` with its default options, unless it is
 * deprecated. A table entry for a rule the installed plugin no longer ships is dropped, because
 * ESLint fails on unknown rules.
 */

/** @typedef {import('eslint').Linter.RulesRecord} RulesRecord */
/** @typedef {Record<string, { meta?: { deprecated?: unknown } }>} PluginRules */

/**
 * @param {RulesRecord} table
 * @param {RulesRecord} undecided entries for rules the table does not list
 * @param {Set<string>} available every rule id that exists, deprecated ones included
 * @returns {RulesRecord}
 */
export function completeRules(table, undecided, available) {
  return {
    ...Object.fromEntries(Object.entries(undecided).filter(([rule]) => !(rule in table))),
    ...Object.fromEntries(Object.entries(table).filter(([rule]) => available.has(rule))),
  };
}

/**
 * A plugin's rules as `completeRules` arguments.
 * @param {PluginRules} rules
 * @param {string} prefix e.g. `import-x/` (empty for core rules)
 * @returns {{ undecided: RulesRecord, available: Set<string> }}
 */
function pluginRules(rules, prefix) {
  const entries = Object.entries(rules);
  return {
    undecided: Object.fromEntries(
      entries
        .filter(([, rule]) => !rule.meta?.deprecated)
        .map(([name]) => [prefix + name, 'error']),
    ),
    available: new Set(entries.map(([name]) => prefix + name)),
  };
}

/**
 * Shorthand for a table that covers exactly one plugin.
 * @param {RulesRecord} table
 * @param {PluginRules} rules
 * @param {string} prefix
 * @returns {RulesRecord}
 */
export function completePluginRules(table, rules, prefix) {
  const { undecided, available } = pluginRules(rules, prefix);
  return completeRules(table, undecided, available);
}
