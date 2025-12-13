import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import * as carddb from 'serverutils/carddb';
import * as cubefn from 'serverutils/cubefn';
import * as render from 'serverutils/render';

import { cubeDao, draftDao } from '../../src/dynamo/daos';
import { uploadDecklistHandler } from '../../src/router/routes/cube/deck';
import {
  createCard,
  createCardDetails,
  createCube,
  createCustomCard,
  createCustomCardDetails,
  createUser,
} from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos');
jest.mock('serverutils/carddb');
jest.mock('serverutils/cubefn');
jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

describe('Upload Decklist Handler', () => {
  const flashMock = jest.fn();
  const CUBE_ID = '5b6eba4f-607d-45f1-9754-5c87142a315d';
  const DRAFT_ID = 'addbaa49-69c3-42a0-bf50-c3eda4f84271';
  const PLAYTEST_REDIRECT_URL = `/cube/playtest/${CUBE_ID}`;

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  const expectError = (errorMessage: string, redirectURL: string) => {
    expect(flashMock).toHaveBeenCalledWith('danger', errorMessage);
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), redirectURL);
  };

  const expectSuccess = () => {
    expect(render.redirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      `/draft/deckbuilder/${DRAFT_ID}`,
    );
  };

  it('should fail if no cube ID is provided', async () => {
    await call(uploadDecklistHandler).withFlash(flashMock).withParams({}).withBody({ body: '1x Card Name' }).send();

    expectError('Invalid cube ID', '/404');
  });

  it('should fail if the cube is not found', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(null);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .withParams({ id: 'cube-id' })
      .withBody({ body: '1x Card Name' })
      .send();

    expectError('Cube not found.', '/404');
  });

  it('should fail if the cube is not viewable', async () => {
    const cube = createCube({ id: CUBE_ID });
    const user = createUser({ id: 'different-user-id' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(false);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(user)
      .withParams({ id: cube.id })
      .withBody({ body: '1x Card Name' })
      .send();

    expectError('Cube not found.', '/404');
  });

  it('should fail if user is not authenticated', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, id: CUBE_ID });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .withParams({ id: cube.id })
      .withBody({ body: '1x Card Name' })
      .send();

    expectError('Not Authorized', PLAYTEST_REDIRECT_URL);
  });

  it('should fail if user is not the cube owner', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, id: CUBE_ID });
    const otherUser = createUser({ id: 'other-user-id' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(otherUser)
      .withParams({ id: cube.id })
      .withBody({ body: '1x Card Name' })
      .send();

    expectError('Not Authorized', PLAYTEST_REDIRECT_URL);
  });

  it('should fail if no cards are provided in the body', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, id: CUBE_ID });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: '' })
      .send();

    expectError('No cards detected', PLAYTEST_REDIRECT_URL);
  });

  it('should parse cards with quantities correctly', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, id: CUBE_ID });
    const cardDetail = createCardDetails({ name: 'Counterspell', name_lower: 'counterspell', cmc: 2, type: 'Instant' });
    const cubeCard = createCard({ cardID: 'card-id-1', details: cardDetail });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [cubeCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id-1']);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: '3x Counterspell' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should have 3 copies of the card
    expect(draftCall.cards).toHaveLength(3);
  });

  it('should handle cards with different notation formats', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({ name: 'Island', name_lower: 'island', cmc: 0, type: 'Land' });
    const cubeCard = createCard({ cardID: 'card-id-1', details: cardDetail });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [cubeCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id-1']);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    // Test both "3x Card" and "3 Card" formats
    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: '2x Island\n4 Island' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should have 2 + 4 = 6 copies of Island
    expect(draftCall.cards).toHaveLength(6);
  });

  it('should find cards in the cube by name', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({
      name: 'Lightning Bolt',
      name_lower: 'lightning bolt',
      cmc: 1,
      type: 'Instant',
    });
    const cubeCard = createCard({ cardID: 'cube-card-id', details: cardDetail, finish: 'foil' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [cubeCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id-1']);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Lightning Bolt' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should have selected the card from cube with foil finish
    expect(draftCall.cards[0]).toEqual(
      expect.objectContaining({
        cardID: 'cube-card-id',
        finish: 'foil',
      }),
    );
  });

  it('should use getMostReasonable when card is not in cube', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, defaultPrinting: 'modern' });
    const cubeCardDetail = createCardDetails({
      name: 'Will of Force',
      name_lower: 'will of force',
      scryfall_id: 'other-id',
      cmc: 5,
      type: 'Instant',
    });
    const reasonableCardDetail = createCardDetails({
      name: 'Force of Will',
      name_lower: 'force of will',
      scryfall_id: 'reasonable-id',
      cmc: 5,
      type: 'Instant',
    });
    const cubeCard = createCard({ cardID: 'other-card-id', details: cubeCardDetail });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [cubeCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id-1', 'card-id-2']);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cubeCardDetail);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(reasonableCardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Force of Will' })
      .send();

    expectSuccess();
    expect(carddb.getMostReasonable).toHaveBeenCalledWith('force of will', cube.defaultPrinting);
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    expect(draftCall.cards[0].cardID).toEqual('reasonable-id');
  });

  it('should use first ID when getMostReasonable returns nothing', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['first-id', 'second-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    const cardDetail = createCardDetails({ name: 'Bolt', name_lower: 'bolt', scryfall_id: 'first-id' });
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Bolt' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    expect(draftCall.cards[0].cardID).toEqual('first-id');
  });

  it('should support custom cards by name', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const customCard = createCustomCard('My Custom Card', { cardID: 'custom-id' });
    const customCardDetail = createCustomCardDetails();
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [customCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(customCardDetail);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'My Custom Card' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    expect(draftCall.cards[0].cardID).toEqual('custom-id');
  });

  it('should place cards in correct columns based on CMC and type', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });

    const creatureCard = createCardDetails({ name: 'Creature', name_lower: 'creature', cmc: 3, type: 'Creature' });
    const spellCard = createCardDetails({ name: 'Spell', name_lower: 'spell', cmc: 2, type: 'Instant' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValueOnce(['creature-id']).mockReturnValueOnce(['spell-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValueOnce(creatureCard).mockReturnValueOnce(spellCard);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Creature\nSpell' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    const { mainboard } = draftCall.seats[0];

    expect(mainboard[0][3]).toContain(0);
    // Spell should be in 2nd row, column 2
    expect(mainboard[1][2]).toContain(1);
  });

  it('should cap creature column at 7', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });

    // Creature with high cmc (should cap at column 7)
    const highCmcCreature = createCardDetails({ name: 'Emrakul', name_lower: 'creature', cmc: 15, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['creature-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(highCmcCreature);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Creature' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    const { mainboard } = draftCall.seats[0];

    // Should be in column 7 (capped at 7 for creatures)
    expect(mainboard[0][7]).toContain(0);
  });

  it('should normalize card names correctly', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({
      name: 'Lightning Bolt',
      name_lower: 'lightning bolt',
      cmc: 1,
      type: 'Instant',
    });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: '           LIGHTNING BOLT' })
      .send();

    expectSuccess();
    // getIdsFromName should be called with normalized name
    expect(carddb.getIdsFromName).toHaveBeenCalledWith('lightning bolt');
  });

  it('should create a draft with correct structure', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, id: 'cube-id', basics: [] });
    const cardDetail = createCardDetails({ name: 'Card', name_lower: 'card', cmc: 2, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: 'cube-id' })
      .withBody({ body: 'Card' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];

    expect(draftCall).toEqual(
      expect.objectContaining({
        cube: 'cube-id',
        owner: owner.id,
        cubeOwner: cube.owner.id,
        type: DRAFT_TYPES.UPLOAD,
        complete: true,
        basics: [],
      }),
    );
    expect(draftCall.date).toBeGreaterThan(0);
    expect(draftCall.seats).toHaveLength(1);
    expect(draftCall.seats[0]).toEqual(
      expect.objectContaining({
        owner: owner.id,
        title: `${owner.username}'s decklist upload`,
      }),
    );
  });

  it('should increment cube numDecks counter', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner, numDecks: 5 });
    const cardDetail = createCardDetails({ name: 'Card', name_lower: 'card', cmc: 1, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Card' })
      .send();

    expectSuccess();
    expect(cubeDao.update).toHaveBeenCalled();
    const updateCall = (cubeDao.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.numDecks).toEqual(6);
  });

  it('should handle unknown cards gracefully', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(null);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Unknown Card Name' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should create deck with empty card list since card was not found
    expect(draftCall.cards).toHaveLength(0);
  });

  it('should handle mixed found and unknown cards', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const knownCard = createCardDetails({ name: 'Known Card', name_lower: 'known card', cmc: 1, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValueOnce(['card-id']).mockReturnValueOnce(null);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(knownCard);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Known Card\nUnknown Card' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should have only 1 card (the known one)
    expect(draftCall.cards).toHaveLength(1);
    expect(draftCall.cards[0].details.name).toEqual('Known Card');
  });

  it('should handle errors during draft creation', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({ name: 'Card', name_lower: 'card', cmc: 1, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockRejectedValue(new Error('Database error'));

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Card' })
      .send();

    expect(render.handleRouteError).toHaveBeenCalled();
  });

  it('should handle multiline card input', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({ name: 'Card', name_lower: 'card', cmc: 1, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    const multilineInput = `2x Card
4 Card
1 Card`;

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: multilineInput })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    // Should have 2 + 4 + 1 = 7 copies total
    expect(draftCall.cards).toHaveLength(7);
  });

  it('should preserve card details from cube', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const cardDetail = createCardDetails({ name: 'Card', name_lower: 'card', cmc: 2, type: 'Creature' });
    const cubeCard = createCard({
      cardID: 'cube-card-id',
      details: cardDetail,
      finish: 'etched',
      imgUrl: 'http://example.com/image.png',
      imgBackUrl: 'http://example.com/back.png',
    });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [cubeCard] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['cube-card-id']);
    (carddb.cardFromId as jest.Mock).mockReturnValue(cardDetail);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Card' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    expect(draftCall.cards[0]).toEqual(
      expect.objectContaining({
        cardID: 'cube-card-id',
        finish: 'etched',
        imgUrl: 'http://example.com/image.png',
        imgBackUrl: 'http://example.com/back.png',
      }),
    );
  });

  it('should handle cards with zero CMC', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const zeroCmcCard = createCardDetails({ name: 'Land', name_lower: 'land', cmc: 0, type: 'Land' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['land-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(zeroCmcCard);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Land' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    const { mainboard } = draftCall.seats[0];

    // Land with cmc 0 and type Land (non-creature) should be 2nd row, first column
    expect(mainboard[1][0]).toContain(0);
  });

  it('should handle undefined CMC as zero', async () => {
    const owner = createUser({ id: 'owner-id' });
    const cube = createCube({ owner });
    const undefinedCmcCard = createCardDetails({ name: 'Card', name_lower: 'card', cmc: undefined, type: 'Creature' });

    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubefn.isCubeViewable as jest.Mock).mockReturnValue(true);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });
    (carddb.getIdsFromName as jest.Mock).mockReturnValue(['card-id']);
    (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);
    (carddb.cardFromId as jest.Mock).mockReturnValue(undefinedCmcCard);
    (draftDao.createDraft as jest.Mock).mockResolvedValue(DRAFT_ID);

    await call(uploadDecklistHandler)
      .withFlash(flashMock)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ body: 'Card' })
      .send();

    expectSuccess();
    expect(draftDao.createDraft).toHaveBeenCalled();
    const draftCall = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
    const { mainboard } = draftCall.seats[0];

    // Should default to column 0 when CMC is undefined
    expect(mainboard[0][0]).toContain(0);
  });
});
