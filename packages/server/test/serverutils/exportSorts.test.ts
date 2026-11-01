import { EXPORT_SORTS, sortForDownload } from '@utils/sorting/Sort';

const mk = (name: string, over: any = {}) =>
  ({
    cardID: name,
    tags: over.tags ?? [],
    details: {
      name,
      type: over.type ?? 'Instant',
      colors: over.colors ?? [],
      color_identity: over.ci ?? [],
      cmc: 1,
      set: 'x',
      collector_number: '1',
    },
  }) as any;

describe('EXPORT_SORTS', () => {
  it('is the fixed export ordering', () => {
    expect([...EXPORT_SORTS]).toEqual(['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical']);
  });

  // The whole point of the constant: no sort in it may place one card in two groups.
  it('emits every card exactly once, including cards that fall in several groups', () => {
    const cards = [
      mk('Gold Artifact Creature', {
        type: 'Artifact Creature — Bear',
        colors: ['W', 'U'],
        ci: ['W', 'U'],
        tags: ['a', 'b'],
      }),
      mk('Five Color', { colors: ['W', 'U', 'B', 'R', 'G'], ci: ['W', 'U', 'B', 'R', 'G'] }),
      mk('Plain Instant'),
    ];
    const [p, s, t, q] = EXPORT_SORTS;

    const out = sortForDownload(cards, p, s, t, q, true);

    expect(out.map((c: any) => c.details.name).sort()).toEqual([
      'Five Color',
      'Gold Artifact Creature',
      'Plain Instant',
    ]);
  });

  // showother=true is load-bearing beyond duplicates: a card with no label at all is otherwise dropped.
  it('keeps a card that no sort group claims', () => {
    const cards = [mk('Typeless Custom', { type: '' }), mk('Plain Instant')];
    const [p, s, t, q] = EXPORT_SORTS;

    const out = sortForDownload(cards, p, s, t, q, true);

    expect(out).toHaveLength(2);
  });
});
