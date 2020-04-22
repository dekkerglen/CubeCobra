const sinon = require('sinon');
const carddb = require('../../serverjs/cards');
const Card = require('../../models/card');
const { makeFilter } = require('../../serverjs/filterCubes');

const TEST_IDS = ['123', '456', '7890'];

describe('filterCubes', () => {
  beforeEach(() => {
    sinon.stub(Card, 'findOne');
    Card.findOne.withArgs(sinon.match.any).returns({ cubes: TEST_IDS });
  });

  afterEach(() => {
    Card.findOne.restore();
  });

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
    expect(fieldsUsed).toEqual(['categoryPrefixes']);
    expect(query).toEqual({ categoryPrefixes: { $regex: 'Commander', $options: 'i' } });
  });

  it('correctly parses categoryOverride condition', async () => {
    const { err, filter } = await makeFilter('category:Legacy', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['categoryOverride']);
    expect(query).toEqual({ categoryOverride: { $regex: 'Legacy', $options: 'i' } });
  });

  it('correctly parses card condition', async () => {
    const { err, filter } = await makeFilter('card:murder', carddb);

    expect(err).toBeFalsy();
    const { query, fieldsUsed } = filter;
    expect(fieldsUsed).toEqual(['card']);
    expect(query).toEqual({ _id: { $in: TEST_IDS } });
  });
});
