import { ART_SERIES_CARD_SUFFIX } from '../../src/client/utils/cardutil';
import { convertName, ScryfallCard } from '../../src/jobs/utils/update_cards';

//TODO: Expand as more tests are added
const createScryfallCard = (name: string, layout: string): ScryfallCard => {
  return {
    name,
    layout,
  } as ScryfallCard;
};

describe('convertName', () => {
  it('Plain card name', async () => {
    const card = createScryfallCard('Hypnotic Siren', 'normal');
    const result = convertName(card, false);
    expect(result).toEqual('Hypnotic Siren');
  });

  it('Trims whitespace', async () => {
    const card = createScryfallCard('    Hypnotic Siren   ', 'normal');
    const result = convertName(card, false);
    expect(result).toEqual('Hypnotic Siren');
  });

  it('Backside of transforming card', async () => {
    const card = createScryfallCard('Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'transform');
    const result = convertName(card, false);
    expect(result).toEqual('Ajani, Nacatl Pariah');
  });

  it('Backside of transforming card', async () => {
    const card = createScryfallCard('Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'transform');
    const result = convertName(card, true);
    expect(result).toEqual('Ajani, Nacatl Avenger');
  });

  it('Split card is always full name', async () => {
    const card = createScryfallCard('Alive // Well', 'split');
    const result = convertName(card, false);
    expect(result).toEqual('Alive // Well');
  });

  it('Frontside of art series card', async () => {
    //Art cards use the same name on both sides
    const card = createScryfallCard('Island // Island', 'art_series');
    const result = convertName(card, false);
    expect(result).toEqual(`Island ${ART_SERIES_CARD_SUFFIX}`);
  });

  it('Backside of art series card', async () => {
    const card = createScryfallCard('Island // Island', 'art_series');
    const result = convertName(card, true);
    expect(result).toEqual(`Island ${ART_SERIES_CARD_SUFFIX}`);
  });

  it('Card with single slash is a regular name', async () => {
    const card = createScryfallCard('Summon: Choco/Mog', 'normal');
    const result = convertName(card, false);
    expect(result).toEqual(`Summon: Choco/Mog`);
  });
});
