import {
  exportCardName,
  exportFileName,
  exportTextValue,
  forgeLine,
  forgeName,
  mtgoName,
  setAndNumberLine,
  xmageLine,
} from '../../src/serverutils/textExport';
import { createCard, createCardDetails, createCustomCard } from '../test-utils/data';

const printed = (overrides = {}) =>
  createCard({
    cardID: 'bears-id',
    details: createCardDetails({ name: 'Grizzly Bears', set: 'lea', collector_number: '123' }),
    ...overrides,
  });

// Custom cards and vouchers resolve to a placeholder that carries no printing information.
const unprinted = (name: string) =>
  createCustomCard(name, {
    details: createCardDetails({ name: 'Invalid Card', set: '', collector_number: '' }),
  });

describe('exportTextValue', () => {
  it.each([
    ['CRLF', 'Bad\r\n1 Black Lotus'],
    ['LF', 'Bad\n1 Black Lotus'],
    ['CR', 'Bad\r1 Black Lotus'],
    ['tab', 'Bad\t1 Black Lotus'],
    ['line separator', 'Bad\u20281 Black Lotus'],
  ])('collapses a %s so the value cannot become a second export line', (_label, value) => {
    expect(exportTextValue(value)).toBe('Bad 1 Black Lotus');
  });

  it('collapses a run of breaks into a single space', () => {
    expect(exportTextValue('Bad\r\n\r\n\tLotus')).toBe('Bad Lotus');
  });

  it('trims the result so a leading break does not indent the line', () => {
    expect(exportTextValue('\r\nBolt\r\n')).toBe('Bolt');
  });

  it('leaves an ordinary name untouched', () => {
    expect(exportTextValue('Fire // Ice')).toBe('Fire // Ice');
  });

  it.each([null, undefined, ''])('maps %p to an empty string', (value) => {
    expect(exportTextValue(value)).toBe('');
  });
});

describe('forgeName', () => {
  it('folds a pipe, which Forge would otherwise read as the set separator', () => {
    expect(forgeName('Pipe|Name')).toBe('Pipe/Name');
  });

  it('also collapses line breaks', () => {
    expect(forgeName('Bad\r\nLotus|XYZ')).toBe('Bad Lotus/XYZ');
  });
});

describe('exportFileName', () => {
  it('strips characters that are not safe in a Content-disposition filename', () => {
    expect(exportFileName('My "Cube"; v2')).toBe('MyCubev2');
  });

  it('falls back when the name has no ASCII word characters at all', () => {
    expect(exportFileName('キューブ')).toBe('cube');
  });

  it('accepts a caller-supplied fallback', () => {
    expect(exportFileName('', 'deck')).toBe('deck');
  });

  it.each([null, undefined])('falls back for %p', (value) => {
    expect(exportFileName(value)).toBe('cube');
  });
});

describe('exportCardName', () => {
  it('uses the catalog name for a real printing', () => {
    expect(exportCardName(printed())).toBe('Grizzly Bears');
  });

  it("uses a custom card's own name rather than the placeholder", () => {
    expect(exportCardName(unprinted('My Custom'))).toBe('My Custom');
  });

  it('flattens a line break in a custom name', () => {
    expect(exportCardName(unprinted('Bad\r\n1 Black Lotus'))).toBe('Bad 1 Black Lotus');
  });
});

describe('setAndNumberLine', () => {
  it('appends the set and collector number of a real printing', () => {
    expect(setAndNumberLine(printed())).toBe('Grizzly Bears (LEA) 123');
  });

  it('emits a bare name when there is no printing, rather than empty brackets', () => {
    expect(setAndNumberLine(unprinted('My Custom'))).toBe('My Custom');
  });
});

describe('xmageLine', () => {
  it('prefixes the version block for a real printing', () => {
    expect(xmageLine(printed())).toBe('[LEA:123] Grizzly Bears');
  });

  it('drops the version block when there is no printing, since `[:]` fails to import', () => {
    expect(xmageLine(unprinted('My Custom'))).toBe('My Custom');
  });
});

describe('forgeLine', () => {
  it('appends the set after the separator for a real printing', () => {
    expect(forgeLine(printed())).toBe('Grizzly Bears|LEA');
  });

  it('drops the separator when there is no set, so nothing reads as an empty set code', () => {
    expect(forgeLine(unprinted('My Custom'))).toBe('My Custom');
  });

  it('folds a pipe in a custom name', () => {
    expect(forgeLine(unprinted('Pipe|Name'))).toBe('Pipe/Name');
  });
});

describe('mtgoName', () => {
  it('writes a split card with a single slash', () => {
    const card = createCard({ details: createCardDetails({ name: 'Fire // Ice' }) });
    expect(mtgoName(card)).toBe('Fire/Ice');
  });

  it('keeps distinct custom cards distinguishable', () => {
    expect(mtgoName(unprinted('Alpha'))).toBe('Alpha');
    expect(mtgoName(unprinted('Beta'))).toBe('Beta');
  });
});
