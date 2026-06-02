/**
 * Compatibility barrel for the manabase heuristic modules.
 *
 * Most callers should keep importing from here unless they specifically need one of the
 * lower-level modules. The split is for readability and maintenance, not to force a broad
 * import migration right now.
 */
export * from './manabaseBasics';
export * from './manabaseFetch';
export * from './manabaseLandRules';
export * from './manabaseShared';
