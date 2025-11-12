import { convertName, ScryfallCard, ScryfallCardFace } from '@jobs/utils/update_cards';
import { ART_SERIES_CARD_SUFFIX } from '@utils/cardutil';

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
    const card = createScryfallCard('Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'transform', [
      createCardFace('Ajani, Nacatl Pariah'),
      createCardFace('Ajani, Nacatl Avenger'),
    ]);

    const result = convertName(card, false);
    expect(result).toEqual('Ajani, Nacatl Pariah');
  });

  it('Backside of transforming card', async () => {
    const card = createScryfallCard('Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', 'transform', [
      createCardFace('Ajani, Nacatl Avenger'),
    ]);
    const result = convertName(card, true);
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

  it('Art series Room card, with double names', async () => {
    const card = createScryfallCard('Mirror Room // Fractured Realm // Mirror Room // Fractured Realm', 'art_series', [
      createCardFace('Mirror Room // Fractured Realm'),
      createCardFace('Mirror Room // Fractured Realm'),
    ]);
    const result = convertName(card, true);
    expect(result).toEqual(`Mirror Room // Fractured Realm ${ART_SERIES_CARD_SUFFIX}`);
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

  it('Non-english printed names arent used', async () => {
    const card = createScryfallCard('Silvan Library', 'normal');
    card.printed_name = 'Biblioteca silvana';
    card.lang = 'es';
    const result = convertName(card, false);
    expect(result).toEqual(`Silvan Library`);
  });

  it('Non-english printed names arent used, multiple faces', async () => {
    const face = createCardFace('Aclazotz, Deepest Betrayal');
    face.printed_name = '最深の裏切り、アクロゾズ';

    const face2 = createCardFace('Temple of the Dead');
    face2.printed_name = '死者の神殿';

    const card = createScryfallCard('Aclazotz, Deepest Betrayal // Temple of the Dead', 'transform', [face, face2]);
    card.lang = 'jp';
    const result = convertName(card, false);
    expect(result).toEqual(`Aclazotz, Deepest Betrayal`);

    //Backsides are only passed the back face
    const backCard = createScryfallCard('Aclazotz, Deepest Betrayal // Temple of the Dead', 'transform', [face2]);
    card.lang = 'jp';

    const backResult = convertName(backCard, true);
    expect(backResult).toEqual(`Temple of the Dead`);
  });

  it('Phyrexian language isnt real', async () => {
    const card = createScryfallCard('Phyrexian Arena', 'normal');
    card.printed_name = '|fyrs,CebDZFst.';
    card.lang = 'ph';
    const result = convertName(card, false);
    expect(result).toEqual(`Phyrexian Arena`);
  });

  it('Neither is Quenya (Elvish)', async () => {
    const card = createScryfallCard('Sol ring', 'normal');
    card.printed_name = ' ';
    card.lang = 'qya';
    const result = convertName(card, false);
    expect(result).toEqual(`Sol ring`);
  });

  it('Phyrexian language isnt real, card face edition', async () => {
    const face = createCardFace('Mental mistep');
    face.printed_name = '|Vgu$e&yl,tFRErt.';

    const face2 = createCardFace('Mental mistep2');
    face2.printed_name = '|Vgu$e&yl,tFRErt2.';

    const card = createScryfallCard('Phyrexian Arena', 'normal', [face, face2]);
    card.printed_name = '|fyrs,CebDZFst.';
    card.lang = 'ph';
    const result = convertName(card, false);
    expect(result).toEqual(`Mental mistep`);
  });
});
