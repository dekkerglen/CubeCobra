import { ART_SERIES_CARD_SUFFIX } from '../../src/client/utils/cardutil';
import { convertName, ScryfallCard, ScryfallCardFace } from '../../src/jobs/utils/update_cards';

const createCardFace = (name: string): ScryfallCardFace => {
  return {
    object: 'card_face',
    name,
  } as ScryfallCardFace;
};

//TODO: Expand as more tests are added
const createScryfallCard = (name: string, layout: string, cardFaces?: Partial<ScryfallCardFace>[]): ScryfallCard => {
  return {
    name,
    layout,
    card_faces: cardFaces || [],
  } as ScryfallCard;
};
//Art cards use the same name on both sides
const islandArtCard = createScryfallCard('Island // Island', 'art_series', [
  createCardFace('Island'),
  createCardFace('Island'),
]);

describe('convertName', () => {
  const ajani = createScryfallCard('Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'transform', [
    createCardFace('Ajani, Nacatl Pariah'),
    createCardFace('Ajani, Nacatl Avenger'),
  ]);

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
    const result = convertName(ajani, false);
    expect(result).toEqual('Ajani, Nacatl Pariah');
  });

  it('Backside of transforming card', async () => {
    const result = convertName(ajani, true);
    expect(result).toEqual('Ajani, Nacatl Avenger');
  });

  it('Split card is always full name', async () => {
    const card = createScryfallCard('Alive // Well', 'split', [createCardFace('Alive'), createCardFace('Well')]);
    const result = convertName(card, false);
    expect(result).toEqual('Alive // Well');
  });

  it('Frontside of art series card', async () => {
    const result = convertName(islandArtCard, false);
    expect(result).toEqual(`Island ${ART_SERIES_CARD_SUFFIX}`);
  });

  it('Backside of art series card', async () => {
    const result = convertName(islandArtCard, true);
    expect(result).toEqual(`Island ${ART_SERIES_CARD_SUFFIX}`);
  });

  it('Card with single slash is a regular name', async () => {
    const card = createScryfallCard('Summon: Choco/Mog', 'normal');
    const result = convertName(card, false);
    expect(result).toEqual(`Summon: Choco/Mog`);
  });

  it('Card with double slash that does not have multiple faces', async () => {
    const card = createScryfallCard('SP//dr, Piloted by Peni', 'normal');
    const result = convertName(card, false);
    expect(result).toEqual(`SP//dr, Piloted by Peni`);
  });
});
