import Card, { Changes } from '@utils/datatypes/Card';

import { getTagSuggestions } from 'utils/tagSuggestions';

const card = (tags?: string[]): Card => ({ cardID: 'abc', tags }) as Card;

describe('getTagSuggestions', () => {
  it('includes tags from pending adds, edits and swaps across boards', () => {
    const changes: Changes = {
      version: 1,
      mainboard: { edits: [{ index: 0, oldCard: card(), newCard: card(['Ramp']) }] },
      maybeboard: {
        adds: [card(['Draw'])],
        swaps: [{ index: 0, oldCard: card(), card: card(['Tempo']) }],
      },
    };

    const result = getTagSuggestions(['Removal'], changes);

    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining(['Removal', 'Ramp', 'Tempo', 'Draw']));
  });

  it('deduplicates and tolerates missing tags/boards', () => {
    const changes: Changes = { version: 2, mainboard: { adds: [card(['Ramp']), card()] } };

    expect(getTagSuggestions(['Ramp'], changes)).toEqual(['Ramp']);
    expect(getTagSuggestions(['Ramp'], { version: 2 })).toEqual(['Ramp']);
  });
});
