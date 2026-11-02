import { extractMentions, MAX_MENTIONS, resolveMentions } from '@utils/mentions';

describe('extractMentions', () => {
  it.each([
    ['@bob', ['bob']],
    ['hi @bob there', ['bob']],
    ['> @bob', ['bob']],
    ['- @bob', ['bob']],
    ['| @bob |', ['bob']],
    ['x\n@bob', ['bob']],
    ['x\t@bob', ['bob']],
    ['@bob123', ['bob123']],
    ['@bob_smith', ['bob']],
    ['@bob. hi', ['bob']],
    ['@BoB', ['BoB']],
    ['@bob @alice', ['bob', 'alice']],
    ['@bob @bob', ['bob', 'bob']],
    ['mail a@bob', []],
    ['**@bob**', []],
    ['*@bob*', []],
    ['(@bob)', []],
    ['[@bob](https://x.com)', []],
    ['[[@bob]]', []],
    ['see https://x.com/@bob', []],
    ['@ bob', []],
    ['', []],
  ])('extracts from %j', (input, expected) => {
    expect(extractMentions(input)).toEqual(expected);
  });
});

describe('resolveMentions', () => {
  it('keeps only claimed names that appear in the body', () => {
    expect(resolveMentions('hi @alice', 'alice;victim')).toEqual(['alice']);
  });

  it('notifies nobody when the body mentions no one', () => {
    expect(resolveMentions('This is a new comment', 'mentionuser1;mentionuser2')).toEqual([]);
  });

  it('matches case-insensitively but keeps the claimed casing', () => {
    expect(resolveMentions('hi @BoB', 'bob')).toEqual(['bob']);
    expect(resolveMentions('hi @bob', 'BoB')).toEqual(['BoB']);
  });

  it('deduplicates repeated names', () => {
    expect(resolveMentions('@bob @bob @bob', 'bob;bob;bob')).toEqual(['bob']);
  });

  it('caps the number of mentions', () => {
    const names = Array.from({ length: MAX_MENTIONS + 5 }, (_, i) => `user${i}`);
    const body = names.map((n) => `@${n}`).join(' ');
    expect(resolveMentions(body, names.join(';'))).toHaveLength(MAX_MENTIONS);
  });

  it.each([
    ['', []],
    [';;;', []],
    ['   ', []],
    [undefined, []],
  ])('yields nothing for claim string %j', (claimed, expected) => {
    expect(resolveMentions('hi @bob', claimed as string | undefined)).toEqual(expected);
  });

  it('ignores a claim that only appears beyond a truncated body', () => {
    const stored = ('a'.repeat(5000) + ' @victim').substring(0, 5000);
    expect(resolveMentions(stored, 'victim')).toEqual([]);
  });
});
