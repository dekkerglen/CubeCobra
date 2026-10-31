import { exportFileName, exportTextValue, forgeName } from '../../src/serverutils/textExport';

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
