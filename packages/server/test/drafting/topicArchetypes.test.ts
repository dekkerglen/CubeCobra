import {
  type ArchetypeNamesFile,
  type ArchetypeTopicsFile,
  classifyByTopics,
  listArchetypeProfile,
  MIN_TAGGED_CARDS,
  rankTopicArchetypes,
  topicProfile,
} from '@utils/drafting/topicArchetypes';

const shape = { avgManaValue: 3, creatureShare: 0.5, instantSorceryShare: 0.2 };

// Cards a0..a9 load on topic t1 (aggro), r0..r9 on t2 (ramp), x on both; t3 shares t1's name.
const cardTopics: ArchetypeTopicsFile['cardTopics'] = { x: [['t1', 0.5], ['t2', 0.5]] };
for (let i = 0; i < 10; i += 1) {
  cardTopics[`a${i}`] = [['t1', 1]];
  cardTopics[`r${i}`] = [['t2', 1]];
}
cardTopics.dup = [['t3', 1]];

const topics: ArchetypeTopicsFile = {
  format: 1,
  k: 3,
  createdAt: 0,
  topics: ['t1', 't2', 't3'].map((id) => ({ id, topTags: [], cards: [], deckShare: 0.1, shape })),
  cardTopics,
};

const name = (value: string) => ({ name: value, source: 'auto' as const, auto: value });
const names: ArchetypeNamesFile = {
  names: { t1: name('Aggro'), t2: name('Ramp'), t3: name('Aggro') },
  updatedAt: 0,
};

const cards = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe('topicProfile', () => {
  it('sums the topic weights of unique tagged cards and skips untagged ones', () => {
    const { tagged, weights } = topicProfile(['a0', 'a0', 'x', 'land'], cardTopics);
    expect(tagged).toBe(2);
    expect(weights.get('t1')).toBe(1.5);
    expect(weights.get('t2')).toBe(0.5);
  });
});

describe('classifyByTopics', () => {
  it('names the heaviest topic', () => {
    expect(classifyByTopics([...cards('a', 6), ...cards('r', 3)], topics, names)).toBe('Aggro');
    expect(classifyByTopics([...cards('a', 3), ...cards('r', 6)], topics, names)).toBe('Ramp');
  });

  it('names nothing below the tagged-card minimum', () => {
    expect(classifyByTopics(cards('a', MIN_TAGGED_CARDS - 1), topics, names)).toBeNull();
    expect(classifyByTopics([...cards('a', MIN_TAGGED_CARDS - 1), 'land'], topics, names)).toBeNull();
  });
});

describe('rankTopicArchetypes', () => {
  it('combines topics that share a name and gives shares that sum to 1', () => {
    const ranked = rankTopicArchetypes([...cards('a', 2), 'dup', 'r0'], topics, names);
    expect(ranked.map(({ label }) => label)).toEqual(['Aggro', 'Ramp']);
    expect(ranked[0]!.topicIds.sort()).toEqual(['t1', 't3']);
    expect(ranked[0]!.share).toBeCloseTo(0.75);
    expect(ranked.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1);
  });

  it('is empty for a list with no tagged cards', () => {
    expect(rankTopicArchetypes(['land'], topics, names)).toEqual([]);
  });
});

describe('listArchetypeProfile', () => {
  it('lists the cards carrying each archetype, heaviest first', () => {
    const [aggro, ramp] = listArchetypeProfile(['a1', 'x', 'a0', 'r0', 'a0'], topics, names, 2);
    expect(aggro!.label).toBe('Aggro');
    expect(aggro!.topCards).toEqual(['a0', 'a1']);
    expect(ramp!.topCards).toEqual(['r0', 'x']);
  });
});
