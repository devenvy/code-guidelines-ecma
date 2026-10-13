/**
 * Only the rule tables turn rules on: a rule a newer plugin version adds stays off until a table
 * decides it (`pnpm run rules:add` does that on Dependabot PRs here). A table entry for a rule
 * the installed plugin no longer ships is dropped, because ESLint fails on unknown rules, and an
 * app may install a newer plugin than the tables were written for.
 */

/** @typedef {import('eslint').Linter.RulesRecord} RulesRecord */

/**
 * @param {RulesRecord} table
 * @param {Iterable<string>} available every rule id that exists, deprecated ones included
 * @returns {RulesRecord}
 */
export function installedRules(table, available) {
  const exists = new Set(available);
  return Object.fromEntries(Object.entries(table).filter(([rule]) => exists.has(rule)));
}

/**
 * `installedRules` for a table that covers exactly one plugin.
 * @param {RulesRecord} table
 * @param {Record<string, unknown>} rules the plugin's rules
 * @param {string} prefix e.g. `import-x/` (empty for core rules)
 * @returns {RulesRecord}
 */
export function installedPluginRules(table, rules, prefix) {
  return installedRules(
    table,
    Object.keys(rules).map((name) => prefix + name),
  );
}
