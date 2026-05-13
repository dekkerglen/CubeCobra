import { ArchetypeSkeleton, BuiltDeck, CardMeta, SimulatedPool } from '@utils/datatypes/SimulationReport';

import { OTAG_BUCKET_MAP } from './otagBucketMap';

const COLOR_FULL_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

export function archetypeFullName(colorPair: string): string {
  if (!colorPair || colorPair === 'C') return 'Colorless';
  const parts = colorPair
    .split('')
    .filter((c) => c in COLOR_FULL_NAMES)
    .map((c) => COLOR_FULL_NAMES[c]!);
  return parts.length > 0 ? parts.join('/') : colorPair;
}

export function getPoolMainCards(pool: SimulatedPool, deck: BuiltDeck | null, cardMeta: Record<string, CardMeta>): string[] {
  if (deck !== null) return deck.mainboard;
  return pool.picks.map((pick) => pick.oracle_id).filter((oracleId) => !!cardMeta[oracleId]);
}

/**
 * Extracts all theme feature keys for a card:
 *   otag:<bucket>  canonical archetype bucket from OTAG_BUCKET_MAP
 *   ctype:<Type>   creature subtype (e.g. "ctype:Elf")
 *   type:<Type>    broad card type (e.g. "type:Artifact")
 */
export function extractThemeFeatures(type: string, oracleTags: string[] | undefined): string[] {
  const features: string[] = [];
  const typeLower = type.toLowerCase();

  const seen = new Set<string>();
  for (const tag of oracleTags ?? []) {
    const defaultBucket = OTAG_BUCKET_MAP[tag];
    if (!defaultBucket) continue;
    if (!seen.has(defaultBucket)) {
      seen.add(defaultBucket);
      features.push(`otag:${defaultBucket}`);
    }
  }

  if (typeLower.includes('artifact') && !typeLower.includes('enchantment')) features.push('type:Artifact');
  if (typeLower.includes('enchantment')) features.push('type:Enchantment');
  if (typeLower.includes('instant') || typeLower.includes('sorcery')) features.push('type:Spell');

  if (typeLower.includes('creature')) {
    const subtypePart = type.split('—')[1] ?? type.split('-')[1] ?? '';
    for (const subtype of subtypePart.trim().split(/\s+/).filter((s) => s.length > 1)) {
      features.push(`ctype:${subtype}`);
    }
  }

  return features;
}

function pluralizeCreatureType(name: string): string {
  // Invariant plurals — already plural or unchanged
  if (name === 'Merfolk' || name === 'Sheep' || name === 'Fish') return name;
  if (name.endsWith('f')) return name.slice(0, -1) + 'ves';
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z')) return name + 'es';
  return name + 's';
}

export function formatFeatureKey(key: string): string {
  if (key.startsWith('otag:')) {
    return key.slice(5).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (key.startsWith('ctype:')) return pluralizeCreatureType(key.slice(6));
  if (key.startsWith('type:')) return `${key.slice(5)}s`;
  return key;
}

export function formatClusterThemeLabels(rankedTags: { tag: string; lift: number }[], limit = 5): string[] {
  return rankedTags.slice(0, limit).map(({ tag }) => formatFeatureKey(tag));
}

const MIN_LIFT = 1.5;
const MIN_OTAG_LIFT = 1.15;
const MIN_CTYPE_CARDS_PER_DECK = 5;
const MIN_GLOBAL_CTYPE_DECKS = 5;
const MIN_GLOBAL_FEATURE_CARDS = 3;

export function computeClusterThemes(
  skeletons: ArchetypeSkeleton[],
  simulatedPools: SimulatedPool[],
  deckBuilds: BuiltDeck[] | null,
  cardMeta: Record<string, CardMeta>,
): { poolThemes: Map<number, { tag: string; lift: number }[]>; tagAllowlist: Set<string> } {
  const poolByIndex = new Map(simulatedPools.map((p) => [p.poolIndex, p]));

  const allPoolIndices = skeletons.flatMap((s) => s.poolIndices);
  const totalDecks = allPoolIndices.length;
  if (totalDecks === 0) return { poolThemes: new Map(), tagAllowlist: new Set() };

  const globalCardCount = new Map<string, number>();
  let globalTotalCards = 0;
  const globalCreatureTypeDeckCount = new Map<string, number>();

  for (const poolIndex of allPoolIndices) {
    const pool = poolByIndex.get(poolIndex);
    if (!pool) continue;
    const cards = getPoolMainCards(pool, deckBuilds?.[poolIndex] ?? null, cardMeta);
    globalTotalCards += cards.length;

    for (const oracleId of cards) {
      const meta = cardMeta[oracleId];
      for (const key of extractThemeFeatures(meta?.type ?? '', meta?.oracleTags)) {
        if (!key.startsWith('ctype:')) globalCardCount.set(key, (globalCardCount.get(key) ?? 0) + 1);
      }
    }

    const deckCreatureTypeCounts = new Map<string, number>();
    for (const oracleId of cards) {
      const meta = cardMeta[oracleId];
      for (const key of extractThemeFeatures(meta?.type ?? '', meta?.oracleTags)) {
        if (key.startsWith('ctype:')) deckCreatureTypeCounts.set(key, (deckCreatureTypeCounts.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of deckCreatureTypeCounts) {
      if (count >= MIN_CTYPE_CARDS_PER_DECK) {
        globalCreatureTypeDeckCount.set(key, (globalCreatureTypeDeckCount.get(key) ?? 0) + 1);
      }
    }
  }

  const result = new Map<number, { tag: string; lift: number }[]>();

  for (const skeleton of skeletons) {
    const clusterCardCount = new Map<string, number>();
    let clusterTotalCards = 0;
    const clusterCreatureTypeDeckCount = new Map<string, number>();
    const clusterDeckCount = skeleton.poolIndices.length;

    for (const poolIndex of skeleton.poolIndices) {
      const pool = poolByIndex.get(poolIndex);
      if (!pool) continue;
      const cards = getPoolMainCards(pool, deckBuilds?.[poolIndex] ?? null, cardMeta);
      clusterTotalCards += cards.length;

      for (const oracleId of cards) {
        const meta = cardMeta[oracleId];
        for (const key of extractThemeFeatures(meta?.type ?? '', meta?.oracleTags)) {
          if (!key.startsWith('ctype:')) clusterCardCount.set(key, (clusterCardCount.get(key) ?? 0) + 1);
        }
      }

      const deckCreatureTypeCounts = new Map<string, number>();
      for (const oracleId of cards) {
        const meta = cardMeta[oracleId];
        for (const key of extractThemeFeatures(meta?.type ?? '', meta?.oracleTags)) {
          if (key.startsWith('ctype:')) deckCreatureTypeCounts.set(key, (deckCreatureTypeCounts.get(key) ?? 0) + 1);
        }
      }
      for (const [key, count] of deckCreatureTypeCounts) {
        if (count >= MIN_CTYPE_CARDS_PER_DECK) {
          clusterCreatureTypeDeckCount.set(key, (clusterCreatureTypeDeckCount.get(key) ?? 0) + 1);
        }
      }
    }

    if (clusterTotalCards === 0) continue;

    const nonTribalEntries = [...clusterCardCount.keys()]
      .filter((tag) => (globalCardCount.get(tag) ?? 0) >= MIN_GLOBAL_FEATURE_CARDS)
      .map((tag) => {
        const globalRate = (globalCardCount.get(tag) ?? 0) / globalTotalCards;
        const clusterRate = clusterCardCount.get(tag)! / clusterTotalCards;
        const lift = globalRate > 0 ? clusterRate / globalRate : 0;
        return { tag, lift };
      });

    const creatureTypeEntries = [...clusterCreatureTypeDeckCount.keys()]
      .filter((key) => (globalCreatureTypeDeckCount.get(key) ?? 0) >= MIN_GLOBAL_CTYPE_DECKS)
      .map((tag) => {
        const globalRate = (globalCreatureTypeDeckCount.get(tag) ?? 0) / totalDecks;
        const clusterRate = clusterCreatureTypeDeckCount.get(tag)! / clusterDeckCount;
        const lift = globalRate > 0 ? clusterRate / globalRate : 0;
        return { tag, lift };
      })
      .filter(({ lift }) => lift >= MIN_LIFT)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 2);

    const rankedTags = [
      ...nonTribalEntries.filter(({ tag, lift }) => lift >= (tag.startsWith('otag:') ? MIN_OTAG_LIFT : MIN_LIFT)),
      ...creatureTypeEntries,
    ].sort((a, b) => b.lift - a.lift);

    for (const poolIndex of skeleton.poolIndices) {
      result.set(poolIndex, rankedTags);
    }
  }

  const tagAllowlist = new Set<string>();
  for (const rankedTags of result.values()) {
    for (const { tag } of rankedTags) tagAllowlist.add(tag);
  }

  return { poolThemes: result, tagAllowlist };
}

export function inferDraftThemes(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
  clusterThemes?: Map<number, { tag: string; lift: number }[]>,
  tagAllowlist?: Set<string>,
): string[] {
  if (clusterThemes) {
    const rankedTags = clusterThemes.get(pool.poolIndex);
    if (rankedTags && rankedTags.length > 0) {
      const cards = getPoolMainCards(pool, deck, cardMeta);
      const deckFeatureCounts = new Map<string, number>();
      for (const oracleId of cards) {
        const meta = cardMeta[oracleId];
        for (const key of extractThemeFeatures(meta?.type ?? '', meta?.oracleTags)) {
          if (!tagAllowlist || tagAllowlist.has(key)) {
            deckFeatureCounts.set(key, (deckFeatureCounts.get(key) ?? 0) + 1);
          }
        }
      }
      const minCount = Math.max(2, Math.round(cards.length * 0.08));
      const themes = rankedTags
        .filter(({ tag }) => (deckFeatureCounts.get(tag) ?? 0) >= minCount)
        .sort((a, b) => (deckFeatureCounts.get(b.tag) ?? 0) - (deckFeatureCounts.get(a.tag) ?? 0))
        .slice(0, 20)
        .map(({ tag }) => `${formatFeatureKey(tag)} (${deckFeatureCounts.get(tag)!})`);
      if (themes.length > 0) return themes;
    }
  }

  // Fallback: type-based heuristics
  const cards = getPoolMainCards(pool, deck, cardMeta);
  let artifacts = 0;
  let enchantments = 0;
  let instantsSorceries = 0;
  let creatures = 0;
  const creatureTypeCounts = new Map<string, number>();
  for (const oracleId of cards) {
    const type = cardMeta[oracleId]?.type ?? '';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('artifact')) artifacts++;
    if (typeLower.includes('enchantment')) enchantments++;
    if (typeLower.includes('instant') || typeLower.includes('sorcery')) instantsSorceries++;
    if (typeLower.includes('creature')) {
      creatures++;
      const subtypePart = type.split('—')[1] ?? type.split('-')[1] ?? '';
      for (const creatureType of subtypePart.trim().split(/\s+/).filter(Boolean)) {
        creatureTypeCounts.set(creatureType, (creatureTypeCounts.get(creatureType) ?? 0) + 1);
      }
    }
  }
  const topCreatureType = [...creatureTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const themes: string[] = [];
  if (artifacts >= 5) themes.push('Artifacts');
  if (instantsSorceries >= 8) themes.push('Spells');
  if (enchantments >= 5) themes.push('Enchantments');
  if (topCreatureType && topCreatureType[1] >= 4 && topCreatureType[1] / Math.max(1, creatures) >= 0.3) {
    themes.push(pluralizeCreatureType(topCreatureType[0]));
  }
  if (creatures >= 16 && themes.length < 20) themes.push('Creatures');
  if (themes.length === 0) themes.push(archetypeFullName(pool.archetype));
  return themes.slice(0, 30);
}
