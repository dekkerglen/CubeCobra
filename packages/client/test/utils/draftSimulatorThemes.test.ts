import {
  archetypeFullName,
  computeClusterThemes,
  extractThemeFeatures,
  formatClusterThemeLabels,
  formatFeatureKey,
  getPoolMainCards,
  inferDraftThemes,
} from '../../src/utils/draftSimulatorThemes';

import type { ArchetypeSkeleton, BuiltDeck, CardMeta, SimulatedPool } from '@utils/datatypes/SimulationReport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMeta = (overrides: Partial<CardMeta> = {}): CardMeta => ({
  name: 'Test Card',
  imageUrl: '',
  colorIdentity: [],
  elo: 1200,
  cmc: 2,
  type: 'Creature — Human',
  ...overrides,
});

const makePool = (poolIndex: number, cardIds: string[], archetype = 'UR'): SimulatedPool => ({
  poolIndex,
  draftIndex: 0,
  seatIndex: poolIndex,
  archetype,
  picks: cardIds.map((id, i) => ({ oracle_id: id, name: id, imageUrl: '', packNumber: 0, pickNumber: i + 1 })),
});

const makeSkeleton = (clusterId: number, poolIndices: number[]): ArchetypeSkeleton => ({
  clusterId,
  colorProfile: 'UR',
  poolCount: poolIndices.length,
  poolIndices,
  coreCards: { default: [], excludingFixing: [] },
  occasionalCards: [],
  sideboardCards: [],
  lockPairs: [],
});

// ---------------------------------------------------------------------------
// archetypeFullName
// ---------------------------------------------------------------------------
describe('archetypeFullName', () => {
  it('returns Colorless for empty string', () => {
    expect(archetypeFullName('')).toBe('Colorless');
  });

  it('returns Colorless for C', () => {
    expect(archetypeFullName('C')).toBe('Colorless');
  });

  it('maps single colors', () => {
    expect(archetypeFullName('W')).toBe('White');
    expect(archetypeFullName('U')).toBe('Blue');
    expect(archetypeFullName('B')).toBe('Black');
    expect(archetypeFullName('R')).toBe('Red');
    expect(archetypeFullName('G')).toBe('Green');
  });

  it('joins multiple colors with slash', () => {
    expect(archetypeFullName('WU')).toBe('White/Blue');
    expect(archetypeFullName('BRG')).toBe('Black/Red/Green');
  });

  it('returns unknown strings as-is', () => {
    expect(archetypeFullName('XYZ')).toBe('XYZ');
  });
});

// ---------------------------------------------------------------------------
// extractThemeFeatures
// ---------------------------------------------------------------------------
describe('extractThemeFeatures', () => {
  it('returns empty array for unknown type and no tags', () => {
    expect(extractThemeFeatures('Land', undefined)).toEqual([]);
  });

  it('maps known oracle tags to otag: buckets', () => {
    const result = extractThemeFeatures('Instant', ['removal']);
    expect(result).toContain('otag:removal');
  });

  it('skips unknown oracle tags', () => {
    const result = extractThemeFeatures('Creature — Human', ['totally-fake-tag']);
    expect(result.some((f) => f.startsWith('otag:'))).toBe(false);
  });

  it('deduplicates tags that map to the same bucket', () => {
    // Both 'removal' and 'creature-removal' map to 'removal' bucket
    const result = extractThemeFeatures('Instant', ['removal', 'creature-removal']);
    expect(result.filter((f) => f === 'otag:removal')).toHaveLength(1);
  });

  it('produces type:Artifact for artifacts (non-enchantment)', () => {
    expect(extractThemeFeatures('Artifact Creature — Construct', undefined)).toContain('type:Artifact');
  });

  it('produces type:Enchantment for enchantments', () => {
    expect(extractThemeFeatures('Enchantment', undefined)).toContain('type:Enchantment');
  });

  it('does NOT produce type:Artifact for artifact enchantments', () => {
    const result = extractThemeFeatures('Enchantment Artifact', undefined);
    expect(result).not.toContain('type:Artifact');
    expect(result).toContain('type:Enchantment');
  });

  it('produces type:Spell for instants and sorceries', () => {
    expect(extractThemeFeatures('Instant', undefined)).toContain('type:Spell');
    expect(extractThemeFeatures('Sorcery', undefined)).toContain('type:Spell');
  });

  it('extracts creature subtypes after em-dash', () => {
    const result = extractThemeFeatures('Creature — Elf Druid', undefined);
    expect(result).toContain('ctype:Elf');
    expect(result).toContain('ctype:Druid');
  });

  it('extracts creature subtypes after hyphen', () => {
    const result = extractThemeFeatures('Creature - Goblin Warrior', undefined);
    expect(result).toContain('ctype:Goblin');
    expect(result).toContain('ctype:Warrior');
  });

  it('filters single-character subtypes', () => {
    // The filter is s.length > 1; a 1-char subtype should be excluded
    const result = extractThemeFeatures('Creature — A', undefined);
    expect(result.some((f) => f.startsWith('ctype:'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatFeatureKey
// ---------------------------------------------------------------------------
describe('formatFeatureKey', () => {
  it('formats otag keys with title-case and no hyphens', () => {
    expect(formatFeatureKey('otag:draw-card-advantage')).toBe('Draw Card Advantage');
  });

  it('formats ctype keys by pluralizing', () => {
    expect(formatFeatureKey('ctype:Human')).toBe('Humans');
    expect(formatFeatureKey('ctype:Elf')).toBe('Elves');
    expect(formatFeatureKey('ctype:Wolf')).toBe('Wolves');
    expect(formatFeatureKey('ctype:Sphinx')).toBe('Sphinxes');
  });

  it('formats type keys with trailing s', () => {
    expect(formatFeatureKey('type:Artifact')).toBe('Artifacts');
    expect(formatFeatureKey('type:Spell')).toBe('Spells');
  });

  it('returns unknown keys as-is', () => {
    expect(formatFeatureKey('something-else')).toBe('something-else');
  });
});

// ---------------------------------------------------------------------------
// formatClusterThemeLabels
// ---------------------------------------------------------------------------
describe('formatClusterThemeLabels', () => {
  it('returns empty for empty input', () => {
    expect(formatClusterThemeLabels([])).toEqual([]);
  });

  it('respects the limit parameter', () => {
    const tags = [
      { tag: 'otag:removal', lift: 3 },
      { tag: 'otag:draw-card-advantage', lift: 2.5 },
      { tag: 'type:Artifact', lift: 2 },
      { tag: 'ctype:Elf', lift: 1.8 },
      { tag: 'ctype:Human', lift: 1.6 },
      { tag: 'type:Spell', lift: 1.5 },
    ];
    expect(formatClusterThemeLabels(tags, 3)).toHaveLength(3);
    expect(formatClusterThemeLabels(tags, 3)[0]).toBe('Removal');
  });

  it('defaults to 5 entries', () => {
    const tags = Array.from({ length: 8 }, (_, i) => ({ tag: `type:T${i}`, lift: 8 - i }));
    expect(formatClusterThemeLabels(tags)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// getPoolMainCards
// ---------------------------------------------------------------------------
describe('getPoolMainCards', () => {
  const meta = { a: makeMeta({ name: 'Card A' }), b: makeMeta({ name: 'Card B' }) };

  it('returns mainboard when deck is provided', () => {
    const pool = makePool(0, ['a', 'b', 'c']);
    const deck: BuiltDeck = { mainboard: ['a'], sideboard: ['b'] };
    expect(getPoolMainCards(pool, deck, meta)).toEqual(['a']);
  });

  it('returns filtered picks when deck is null', () => {
    const pool = makePool(0, ['a', 'b', 'unknown']);
    expect(getPoolMainCards(pool, null, meta)).toEqual(['a', 'b']);
  });

  it('returns empty when no picks match meta', () => {
    const pool = makePool(0, ['x', 'y']);
    expect(getPoolMainCards(pool, null, meta)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeClusterThemes
// ---------------------------------------------------------------------------
describe('computeClusterThemes', () => {
  it('returns empty result for no skeletons', () => {
    const result = computeClusterThemes([], [], null, {});
    expect(result.poolThemes.size).toBe(0);
    expect(result.tagAllowlist.size).toBe(0);
  });

  it('returns empty result when skeletons have no pool indices', () => {
    const skeleton = makeSkeleton(0, []);
    const result = computeClusterThemes([skeleton], [], null, {});
    expect(result.poolThemes.size).toBe(0);
  });

  it('identifies a dominant artifact theme via lift', () => {
    // Cluster A: all decks run many artifacts; Cluster B: no artifacts
    const cards: Record<string, CardMeta> = {};
    for (let i = 0; i < 10; i++) cards[`art${i}`] = makeMeta({ type: 'Artifact Creature — Construct' });
    for (let i = 0; i < 10; i++) cards[`spell${i}`] = makeMeta({ type: 'Sorcery' });
    for (let i = 0; i < 10; i++) cards[`crea${i}`] = makeMeta({ type: 'Creature — Human' });

    // Cluster A (pools 0-3): artifact-heavy
    const clusterAPools = Array.from({ length: 4 }, (_, i) =>
      makePool(i, [`art0`, `art1`, `art2`, `art3`, `art4`, `art5`, `spell0`, `spell1`]),
    );
    // Cluster B (pools 4-7): creature-heavy, no artifacts
    const clusterBPools = Array.from({ length: 4 }, (_, i) =>
      makePool(i + 4, [`crea0`, `crea1`, `crea2`, `crea3`, `crea4`, `spell0`, `spell1`, `spell2`]),
    );
    const allPools = [...clusterAPools, ...clusterBPools];
    const skeletonA = makeSkeleton(0, [0, 1, 2, 3]);
    const skeletonB = makeSkeleton(1, [4, 5, 6, 7]);

    const result = computeClusterThemes([skeletonA, skeletonB], allPools, null, cards);

    // At least some pools in cluster A should have artifact theme
    const clusterATheme = result.poolThemes.get(0);
    expect(clusterATheme).toBeDefined();
    const hasArtifact = clusterATheme!.some(({ tag }) => tag === 'type:Artifact');
    expect(hasArtifact).toBe(true);
  });

  it('populates tagAllowlist with discriminative tags only', () => {
    const cards: Record<string, CardMeta> = {
      art: makeMeta({ type: 'Artifact' }),
      ench: makeMeta({ type: 'Enchantment' }),
    };
    const pools = [makePool(0, ['art', 'art', 'art', 'art', 'art']), makePool(1, ['ench', 'ench', 'ench', 'ench', 'ench'])];
    const skeletonA = makeSkeleton(0, [0]);
    const skeletonB = makeSkeleton(1, [1]);

    const result = computeClusterThemes([skeletonA, skeletonB], pools, null, cards);
    // tagAllowlist should only contain tags that actually had lift in some cluster
    for (const tag of result.tagAllowlist) {
      let found = false;
      for (const rankedTags of result.poolThemes.values()) {
        if (rankedTags.some((t) => t.tag === tag)) { found = true; break; }
      }
      expect(found).toBe(true);
    }
  });

  it('uses deckBuilds mainboard when provided', () => {
    // Pool has many artifacts but deck sideboard only — mainboard is creatures
    const cards: Record<string, CardMeta> = {
      art: makeMeta({ type: 'Artifact' }),
      crea: makeMeta({ type: 'Creature — Human' }),
    };
    const pool = makePool(0, ['art', 'art', 'art', 'crea', 'crea', 'crea']);
    const deck: BuiltDeck = { mainboard: ['crea', 'crea', 'crea'], sideboard: ['art', 'art', 'art'] };
    const skeleton = makeSkeleton(0, [0]);
    const result = computeClusterThemes([skeleton], [pool], [deck], cards);
    // The artifact theme should not be dominant since mainboard has no artifacts
    const themes = result.poolThemes.get(0) ?? [];
    const hasArtifact = themes.some(({ tag }) => tag === 'type:Artifact');
    expect(hasArtifact).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inferDraftThemes
// ---------------------------------------------------------------------------
describe('inferDraftThemes', () => {
  const artifactMeta = makeMeta({ type: 'Artifact' });
  const spellMeta = makeMeta({ type: 'Instant' });
  const creatureMeta = makeMeta({ type: 'Creature — Human' });
  const enchantMeta = makeMeta({ type: 'Enchantment' });

  it('falls back to type-based heuristics when no clusterThemes', () => {
    const meta: Record<string, CardMeta> = {};
    for (let i = 0; i < 6; i++) meta[`art${i}`] = artifactMeta;
    const pool = makePool(0, Object.keys(meta));
    const themes = inferDraftThemes(pool, null, meta);
    expect(themes).toContain('Artifacts');
  });

  it('falls back to Spells when >= 8 instants/sorceries', () => {
    const meta: Record<string, CardMeta> = {};
    for (let i = 0; i < 8; i++) meta[`spell${i}`] = spellMeta;
    const pool = makePool(0, Object.keys(meta));
    const themes = inferDraftThemes(pool, null, meta);
    expect(themes).toContain('Spells');
  });

  it('falls back to archetype name when no heuristics match', () => {
    const meta: Record<string, CardMeta> = { a: creatureMeta, b: creatureMeta };
    const pool = makePool(0, ['a', 'b'], 'WU');
    const themes = inferDraftThemes(pool, null, meta);
    expect(themes).toContain('White/Blue');
  });

  it('uses clusterThemes when provided and has enough matching cards', () => {
    const meta: Record<string, CardMeta> = {};
    for (let i = 0; i < 10; i++) meta[`rem${i}`] = makeMeta({ type: 'Instant', oracleTags: ['removal'] });
    const pool = makePool(0, Object.keys(meta));

    const clusterThemes = new Map([[0, [{ tag: 'otag:removal', lift: 3.0 }]]]);
    const tagAllowlist = new Set(['otag:removal']);

    const themes = inferDraftThemes(pool, null, meta, clusterThemes, tagAllowlist);
    // Should use the cluster path and show "Removal (N)"
    expect(themes.some((t) => t.startsWith('Removal'))).toBe(true);
  });

  it('falls back when clusterThemes has no entry for pool', () => {
    const meta: Record<string, CardMeta> = {};
    for (let i = 0; i < 5; i++) meta[`art${i}`] = artifactMeta;
    for (let i = 0; i < 5; i++) meta[`ench${i}`] = enchantMeta;
    const pool = makePool(99, Object.keys(meta)); // poolIndex 99, not in clusterThemes
    const clusterThemes = new Map([[0, [{ tag: 'otag:removal', lift: 3 }]]]);
    const themes = inferDraftThemes(pool, null, meta, clusterThemes);
    // Should use fallback since poolIndex 99 is not in map
    expect(themes).toContain('Enchantments');
  });

  it('respects tagAllowlist by only counting allowed features in the cluster path', () => {
    // Pool has 10 removal spells; tagAllowlist includes removal but not draw
    // clusterThemes ranks both removal and draw for this pool
    const meta: Record<string, CardMeta> = {};
    for (let i = 0; i < 10; i++) meta[`rem${i}`] = makeMeta({ type: 'Instant', oracleTags: ['removal'] });
    for (let i = 0; i < 10; i++) meta[`draw${i}`] = makeMeta({ type: 'Sorcery', oracleTags: ['card-draw'] });
    const pool = makePool(0, [...Object.keys(meta).filter((k) => k.startsWith('rem'))]);

    const clusterThemes = new Map([
      [0, [{ tag: 'otag:removal', lift: 3 }, { tag: 'otag:card-draw', lift: 2 }]],
    ]);
    // Only removal is in allowlist — draw should not count
    const tagAllowlist = new Set(['otag:removal']);
    const themes = inferDraftThemes(pool, null, meta, clusterThemes, tagAllowlist);
    // Removal should appear since it's in the allowlist and pool has many removal cards
    expect(themes.some((t) => t.startsWith('Removal'))).toBe(true);
    // Draw should not appear since it's not in the allowlist
    expect(themes.some((t) => t.toLowerCase().includes('draw'))).toBe(false);
  });
});
