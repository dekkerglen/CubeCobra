const carddb = require('../../serverjs/cards');
const { makeFilter } = require('../../serverjs/filterCubes');
const { arraysAreEqualSets } = require('../../dist/utils/Util');

describe('filterCubes', () => {
  it('correctly parses owner_name condition', async () => {
    const { err, filter } = await makeFilter('owner:dekkerglen', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['owner_name']);
    expect(query).toEqual({ owner_name: { $regex: 'dekkerglen', $options: 'i' } });
  });

  it('correctly parses name condition', async () => {
    const { err, filter } = await makeFilter('name:dekkerglen', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['name']);
    expect(query).toEqual({ name: { $regex: 'dekkerglen', $options: 'i' } });
  });

  it('correctly parses numDecks condition', async () => {
    const { err, filter } = await makeFilter('decks>5', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['numDecks']);
    expect(query).toEqual({ numDecks: { $gt: 5 } });
  });

  it('correctly parses card_count condition', async () => {
    const { err, filter } = await makeFilter('cards<180', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['card_count']);
    expect(query).toEqual({ card_count: { $lt: 180 } });
  });

  it('correctly parses categoryPrefixes condition', async () => {
    const { err, filter } = await makeFilter('category:Commander', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(arraysAreEqualSets(fieldsUsed, ['categoryPrefixes', 'type', 'overrideCategory'])).toBeTruthy();
    expect(query).toEqual({
      $or: [
        {
          $and: [
            {
              overrideCategory: true,
            },
            {
              categoryPrefixes: {
                $options: 'i',
                $regex: 'Commander',
              },
            },
          ],
        },
        {
          $and: [
            {
              overrideCategory: false,
            },
            {
              type: {
                $options: 'i',
                $regex: 'Commander',
              },
            },
          ],
        },
      ],
    });
  });

  it('correctly parses categoryOverride condition', async () => {
    const { err, filter } = await makeFilter('category:Legacy', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(arraysAreEqualSets(fieldsUsed, ['categoryOverride', 'type', 'overrideCategory'])).toBeTruthy();
    expect(query).toEqual({
      $or: [
        {
          $and: [
            {
              overrideCategory: true,
            },
            {
              categoryOverride: {
                $options: 'i',
                $regex: 'Legacy',
              },
            },
          ],
        },
        {
          $and: [
            {
              overrideCategory: false,
            },
            {
              type: {
                $options: 'i',
                $regex: 'Legacy',
              },
            },
          ],
        },
      ],
    });
  });
});
