/**
 * CSV import/export round-trip tests.
 *
 * Covers regressions around:
 *   - multiple custom cards each getting their OWN per-row attributes
 *     (previously, all custom cards in a CSV inherited the first one's
 *     characteristics because they shared the 'custom-card' sentinel cardID)
 *   - voucher cards keeping their per-row name and attributes
 *   - tricky name serialization (commas, quotes, apostrophes, em-dashes,
 *     double-faced slashes) surviving a writeCard -> CSVtoCards round-trip
 */
import { Response } from 'express';
import { CSV_HEADER, writeCard } from 'serverutils/cube';
import { CSVtoCards } from 'serverutils/cubefn';

import { createCardDetails } from '../test-utils/data';

jest.mock('serverutils/carddb', () => {
  const placeholder = {
    name: 'placeholder',
    set: '',
    set_name: '',
    collector_number: '',
    type: '',
    cmc: 0,
    parsed_cost: [],
    colors: [],
    image_normal: '',
    image_small: '',
    image_flip: '',
    rarity: '',
    full_name: '',
    name_lower: '',
    artist: '',
    scryfall_id: 'placeholder',
    layout: '',
    full_art: false,
    prices: {},
  };
  return {
    cardFromId: jest.fn(() => placeholder),
    getReasonableById: jest.fn(),
    getMostReasonable: jest.fn(),
    reasonableId: jest.fn(() => true),
    getAllVersionIds: jest.fn(() => ['placeholder']),
  };
});

/**
 * Tiny in-memory Response stub that collects writeCard output. writeCard
 * uses res.write(...) one chunk at a time; we concatenate them here.
 */
function makeResStub() {
  const chunks: string[] = [];
  const res = { write: (chunk: string) => chunks.push(chunk) } as unknown as Response;
  return {
    res,
    body: () => chunks.join(''),
  };
}

describe('CSVtoCards — writing details fields (not importable)', () => {
  it('preserves artist field through writeCard + CSVtoCards round-trip', () => {
    const cardWithArtist = {
      cardID: 'custom-card',
      name: 'custom-card',
      custom_name: 'Test Card',
      cmc: 3,
      type_line: 'Creature',
      colors: ['W'],
      colorCategory: 'White',
      status: 'Not Owned',
      finish: 'Non-foil',
      tags: [],
      notes: '',
      details: createCardDetails({ artist: 'Jackson Pollock' }),
    };

    const { res, body } = makeResStub();
    res.write(`${CSV_HEADER}\r\n`);
    writeCard(res, cardWithArtist as any, 'mainboard');

    const output = body();
    const lines = output.split('\n').filter((l) => l.length > 0);

    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('"Jackson Pollock"');
  });
});

describe('CSVtoCards — custom cards', () => {
  it('imports multiple custom cards, each with its own attributes', () => {
    const csv = [
      CSV_HEADER,
      // name, CMC, Type, Color, Set, Collector Number, Rarity, Color Category, status, Finish, board, maybeboard, image URL, image Back URL, tags, Notes, MTGO ID, Custom, Voucher
      'AlphaCustom,3,Creature,W,,,,White,Not Owned,Non-foil,mainboard,false,,,,,,true,false',
      'BetaCustom,5,Sorcery,B,,,,Black,Not Owned,Non-foil,mainboard,false,,,,,,true,false',
      'GammaCustom,1,Instant,U,,,,Blue,Not Owned,Non-foil,mainboard,false,,,,,,true,false',
    ].join('\r\n');

    const { cardsByBoard, missing } = CSVtoCards(csv);
    expect(missing).toEqual([]);

    const main = cardsByBoard.mainboard!;
    expect(main).toHaveLength(3);

    // Every custom card carries the cardID sentinel but keeps its own attributes
    expect(main.map((c: any) => c.cardID)).toEqual(['custom-card', 'custom-card', 'custom-card']);
    expect(main.map((c: any) => c.custom_name)).toEqual(['AlphaCustom', 'BetaCustom', 'GammaCustom']);
    expect(main.map((c: any) => c.cmc)).toEqual(['3', '5', '1']);
    expect(main.map((c: any) => c.type_line)).toEqual(['Creature', 'Sorcery', 'Instant']);
    expect(main.map((c: any) => c.colors)).toEqual([['W'], ['B'], ['U']]);
    expect(main.map((c: any) => c.colorCategory)).toEqual(['White', 'Black', 'Blue']);
  });

  it('imports multiple voucher cards, each with its own attributes', () => {
    const csv = [
      CSV_HEADER,
      'Voucher One,0,Voucher,,,,,Colorless,Not Owned,Non-foil,mainboard,false,,,,,,false,true',
      'Voucher Two,0,Voucher,,,,,Colorless,Not Owned,Non-foil,mainboard,false,,,,,,false,true',
    ].join('\r\n');

    const { cardsByBoard, missing } = CSVtoCards(csv);
    expect(missing).toEqual([]);

    const main = cardsByBoard.mainboard!;
    expect(main).toHaveLength(2);
    expect(main.map((c: any) => c.cardID)).toEqual(['voucher', 'voucher']);
    expect(main.map((c: any) => c.custom_name)).toEqual(['Voucher One', 'Voucher Two']);
    // Each voucher's name field is replaced by the sentinel; custom_name preserves the original
    expect(main.every((c: any) => c.name === 'voucher')).toBe(true);
  });

  it('preserves tricky names (commas, quotes, apostrophes, em-dashes, slashes) on import', () => {
    // CSV escaping: a literal " is "" inside a quoted field; literal comma stays inside the quoted field
    const csv = [
      CSV_HEADER,
      '"Borrowing 100,000 Arrows",3,Sorcery,U,,,,Blue,Not Owned,Non-foil,mainboard,false,,,,,,false,false',
      '"Yawgmoth\'s Will",3,Sorcery,B,,,,Black,Not Owned,Non-foil,mainboard,false,,,,,,false,false',
      '"Fire // Ice",2,Instant — Adventure,UR,,,,Multicolored,Not Owned,Non-foil,mainboard,false,,,,,,false,false',
      '"Say ""Hello""",1,Instant,W,,,,White,Not Owned,Non-foil,mainboard,false,,,,,,false,false',
    ].join('\r\n');

    const { cardsByBoard } = CSVtoCards(csv);
    const main = cardsByBoard.mainboard!;
    expect(main.map((c: any) => c.name)).toEqual([
      'Borrowing 100,000 Arrows',
      "Yawgmoth's Will",
      'Fire // Ice',
      'Say "Hello"',
    ]);
    // type_line "Instant - Adventure" should be rewritten to use the em-dash
    expect(main[2]!.type_line).toBe('Instant — Adventure');
  });
});

describe('writeCard — round-trip', () => {
  it('round-trips a custom card through writeCard + CSVtoCards with attributes intact', () => {
    const customA = {
      cardID: 'custom-card',
      name: 'custom-card',
      custom_name: 'AlphaCustom',
      cmc: 3,
      type_line: 'Creature',
      colors: ['W'],
      colorCategory: 'White',
      status: 'Not Owned',
      finish: 'Non-foil',
      tags: ['fun', 'tribal'],
      notes: 'plays well in 1v1',
      details: undefined,
    };
    const customB = {
      ...customA,
      custom_name: 'BetaCustom',
      cmc: 5,
      type_line: 'Sorcery',
      colors: ['B'],
      colorCategory: 'Black',
      tags: ['ramp'],
      notes: '',
    };

    const { res, body } = makeResStub();
    res.write(`${CSV_HEADER}\r\n`);
    writeCard(res, customA as any, 'mainboard');
    writeCard(res, customB as any, 'mainboard');

    const { cardsByBoard } = CSVtoCards(body());
    const main = cardsByBoard.mainboard!;
    expect(main).toHaveLength(2);
    expect(main.map((c: any) => c.custom_name)).toEqual(['AlphaCustom', 'BetaCustom']);
    expect(main.map((c: any) => c.cmc)).toEqual(['3', '5']);
    expect(main.map((c: any) => c.colors)).toEqual([['W'], ['B']]);
    expect(main[0]!.tags).toEqual(['fun', 'tribal']);
    expect(main[1]!.tags).toEqual(['ramp']);
  });

  it('round-trips voucher cards with their own attributes', () => {
    const voucherA = {
      cardID: 'voucher',
      name: 'voucher',
      custom_name: 'Voucher One',
      cmc: 0,
      type_line: 'Voucher',
      colors: [],
      colorCategory: 'Colorless',
      status: 'Not Owned',
      finish: 'Non-foil',
      tags: [],
      notes: '',
    };
    const voucherB = { ...voucherA, custom_name: 'Voucher Two', notes: 'second one' };

    const { res, body } = makeResStub();
    res.write(`${CSV_HEADER}\r\n`);
    writeCard(res, voucherA as any, 'mainboard');
    writeCard(res, voucherB as any, 'mainboard');

    const { cardsByBoard } = CSVtoCards(body());
    const main = cardsByBoard.mainboard!;
    expect(main).toHaveLength(2);
    expect(main.map((c: any) => c.custom_name)).toEqual(['Voucher One', 'Voucher Two']);
    expect(main.map((c: any) => c.cardID)).toEqual(['voucher', 'voucher']);
    expect(main[1]!.notes).toBe('second one');
  });

  it('round-trips tricky names through writeCard + CSVtoCards', () => {
    const tricky = ['Borrowing 100,000 Arrows', "Yawgmoth's Will", 'Fire // Ice', 'Say "Hello"'];

    const { res, body } = makeResStub();
    res.write(`${CSV_HEADER}\r\n`);
    for (const name of tricky) {
      writeCard(
        res,
        {
          cardID: 'custom-card',
          name: 'custom-card',
          custom_name: name,
          cmc: 1,
          type_line: 'Instant',
          colors: [],
          colorCategory: 'Colorless',
          status: 'Not Owned',
          finish: 'Non-foil',
          tags: [],
          notes: '',
        } as any,
        'mainboard',
      );
    }

    const { cardsByBoard } = CSVtoCards(body());
    const names = cardsByBoard.mainboard!.map((c: any) => c.custom_name);
    expect(names).toEqual(tricky);
  });
});
