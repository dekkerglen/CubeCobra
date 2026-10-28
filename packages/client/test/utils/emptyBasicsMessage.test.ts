import { getEmptyBasicsMessage } from '../../src/utils/emptyBasicsMessage';

describe('getEmptyBasicsMessage', () => {
  it('explains an opted-out draft to a player', () => {
    expect(getEmptyBasicsMessage('None', false, 'c1')).toEqual({
      message: "This cube doesn't provide basic lands for this draft.",
    });
  });

  it('points an editor of an opted-out draft at Draft Formats settings', () => {
    expect(getEmptyBasicsMessage('None', true, 'c1')).toEqual({
      message: "This cube doesn't provide basic lands for this draft.",
      hint: {
        text: "To offer basics, change this format's Basics board in",
        linkText: 'Draft Formats settings',
        href: '/cube/settings/c1?view=draft-formats',
      },
    });
  });

  it('names a lowercase board key with a capital letter', () => {
    expect(getEmptyBasicsMessage('basics', false, 'c1')).toEqual({
      message: 'This draft uses the Basics board, but it has no cards.',
    });
  });

  it('points an editor of an empty board at the cube list', () => {
    expect(getEmptyBasicsMessage('extras', true, 'c1')).toEqual({
      message: 'This draft uses the Extras board, but it has no cards.',
      hint: {
        text: 'To offer basics, add cards to the Extras board in',
        linkText: 'the cube list',
        href: '/cube/list/c1',
      },
    });
  });

  it('falls back to a neutral message when the draft recorded no board', () => {
    expect(getEmptyBasicsMessage(undefined, false, 'c1')).toEqual({
      message: 'No basic lands are available for this draft.',
    });
  });

  it('tells an editor where basics come from when the draft recorded no board', () => {
    expect(getEmptyBasicsMessage(undefined, true, 'c1')).toEqual({
      message: 'No basic lands are available for this draft.',
      hint: {
        text: "Basic lands come from the cube's Basics board. Add cards to it in",
        linkText: 'the cube list',
        href: '/cube/list/c1',
      },
    });
  });

  it('encodes the cube id in links', () => {
    expect(getEmptyBasicsMessage('None', true, 'a/b').hint?.href).toBe('/cube/settings/a%2Fb?view=draft-formats');
  });
});
