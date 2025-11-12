import express, { Application } from 'express';
import { cardFromId, getAllVersionIds } from 'serverutils/carddb';
import request from 'supertest';

import { createCardDetails, createCustomCardDetails } from '../../test-utils/data';

jest.mock('serverutils/carddb');
// Import the router using CommonJS require (since src/routes/cube/api.js uses module.exports)
 
const cubeApiRouter = require('../../../src/routes/cube/api');

describe('POST /cube/api/getversions', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/cube/api', cubeApiRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should fail validation with non-array body', async () => {
    const res = await request(app).post('/cube/api/getversions').send({ id: 'test-id-1' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/body must be an array/);
  });

  it('should fail validation with invalid UUIDs', async () => {
    const res = await request(app).post('/cube/api/getversions').send(['not-a-uuid']);

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/Each ID must be a valid UUID or custom-card/);
  });

  it('should handle custom-card in the input', async () => {
    const customCard = createCustomCardDetails();

    (cardFromId as jest.Mock).mockReturnValueOnce(customCard).mockReturnValueOnce(customCard);
    (getAllVersionIds as jest.Mock).mockReturnValueOnce(['custom-card']);

    const res = await request(app).post('/cube/api/getversions').send(['custom-card']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      dict: {
        'custom card': [
          {
            name: customCard.name,
            scryfall_id: customCard.scryfall_id,
            oracle_id: customCard.oracle_id,
            version: '-',
            image_normal: customCard.image_normal,
            image_flip: customCard.image_flip,
            prices: customCard.prices,
          },
        ],
      },
    });
  });

  it('should return properly formatted versions for multiple cards', async () => {
    //Need uuids so that the validation doesn't reject
    const mockLightningBolt = createCardDetails({
      name: 'Lightning Bolt',
      scryfall_id: 'a3e1f8d2-4c5b-4e7a-9c2b-1f2e3d4c5b6a',
      oracle_id: 'b7c9e2f1-8d3a-4b5c-9e2f-1a2b3c4d5e6f',
      full_name: 'Lightning Bolt [M10-1]',
      image_normal: 'test-image-1',
      image_flip: undefined,
      prices: { usd: 1.0 },
      released_at: '2009-07-17',
    });

    const mockLightningBoltVersion1 = createCardDetails({
      name: 'Lightning Bolt',
      scryfall_id: 'c2d3e4f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
      oracle_id: 'b7c9e2f1-8d3a-4b5c-9e2f-1a2b3c4d5e6f', // same oracle_id
      full_name: 'Lightning Bolt [M11-1]',
      image_normal: 'test-image-2',
      image_flip: undefined,
      prices: { usd: 0.5 },
      released_at: '2010-07-16',
    });

    const mockShock = createCardDetails({
      name: 'Shock',
      scryfall_id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
      oracle_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
      full_name: 'Shock [M20-1]',
      image_normal: 'test-image-3',
      image_flip: 'test-back-3',
      prices: { usd: 0.1 },
      released_at: '2019-07-12',
    });

    (cardFromId as jest.Mock)
      .mockReturnValueOnce(mockLightningBolt) // First call for getting details
      .mockReturnValueOnce(mockShock) // Second call for getting details
      .mockReturnValueOnce(mockLightningBolt) // Getting versions for first card
      .mockReturnValueOnce(mockLightningBoltVersion1)
      .mockReturnValueOnce(mockShock); // Getting versions for second card

    (getAllVersionIds as jest.Mock)
      .mockReturnValueOnce([mockLightningBolt.scryfall_id, mockLightningBoltVersion1.scryfall_id]) // Versions for Lightning Bolt
      .mockReturnValueOnce([mockShock.scryfall_id]); // Versions for Shock

    const res = await request(app)
      .post('/cube/api/getversions')
      .send([mockLightningBolt.scryfall_id, mockShock.scryfall_id]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      dict: {
        'lightning bolt': [
          //Descending order of release date
          {
            name: mockLightningBoltVersion1.name,
            scryfall_id: mockLightningBoltVersion1.scryfall_id,
            oracle_id: mockLightningBoltVersion1.oracle_id,
            version: 'M11-1',
            image_normal: mockLightningBoltVersion1.image_normal,
            image_flip: mockLightningBoltVersion1.image_flip,
            prices: mockLightningBoltVersion1.prices,
          },
          {
            name: mockLightningBolt.name,
            scryfall_id: mockLightningBolt.scryfall_id,
            oracle_id: mockLightningBolt.oracle_id,
            version: 'M10-1',
            image_normal: mockLightningBolt.image_normal,
            image_flip: mockLightningBolt.image_flip,
            prices: mockLightningBolt.prices,
          },
        ],
        shock: [
          {
            name: mockShock.name,
            scryfall_id: mockShock.scryfall_id,
            oracle_id: mockShock.oracle_id,
            version: 'M20-1',
            image_normal: mockShock.image_normal,
            image_flip: mockShock.image_flip,
            prices: mockShock.prices,
          },
        ],
      },
    });

    // Verify the calls to cardFromId and getAllVersionIds
    expect(cardFromId).toHaveBeenNthCalledWith(1, mockLightningBolt.scryfall_id);
    expect(cardFromId).toHaveBeenNthCalledWith(2, mockShock.scryfall_id);
    expect(getAllVersionIds).toHaveBeenNthCalledWith(1, mockLightningBolt);
    expect(getAllVersionIds).toHaveBeenNthCalledWith(2, mockShock);
  });

  it('should group versions with different names even if the same oracle id', async () => {
    const oracleId = '711ac046-b950-4f88-b8d8-e779b0ae4933';
    const scryfallId1 = '305b8d4e-4030-49f4-bf2a-3f5a1b59435b';
    const scryfallId2 = 'c4768eb3-e35c-49e9-94ac-3e72064750cd';

    const mockCardV1 = createCardDetails({
      name: 'Fire // Ice',
      scryfall_id: scryfallId1,
      oracle_id: oracleId,
      full_name: 'Fire // Ice [INV-1]',
      image_normal: 'fire-ice-image-1',
      image_flip: undefined,
      prices: { usd: 2.0 },
      released_at: '2001-10-01',
    });

    const mockCardV2 = createCardDetails({
      name: 'Power Rangers Combine',
      scryfall_id: scryfallId2,
      oracle_id: oracleId,
      full_name: 'Power Rangers Combine [MH2-1]',
      image_normal: 'power-rangers-combine-2',
      image_flip: undefined,
      prices: { usd: 1550.0 },
      released_at: '2021-06-18',
    });

    (cardFromId as jest.Mock)
      .mockReturnValueOnce(mockCardV1)
      .mockReturnValueOnce(mockCardV2)
      .mockReturnValueOnce(mockCardV1)
      .mockReturnValueOnce(mockCardV2);

    (getAllVersionIds as jest.Mock)
      .mockReturnValueOnce([scryfallId1, scryfallId2])
      .mockReturnValueOnce([scryfallId1, scryfallId2]);

    const res = await request(app).post('/cube/api/getversions').send([scryfallId1]);

    expect(res.status).toBe(200);
    //Both names have all the versions for the oracle id. Therefore when either name is used
    //in the card modal UI, all the versions even those with other names are present
    expect(res.body).toEqual({
      success: 'true',
      dict: {
        'power rangers combine': [
          {
            name: mockCardV2.name,
            scryfall_id: mockCardV2.scryfall_id,
            oracle_id: mockCardV2.oracle_id,
            version: 'MH2-1',
            image_normal: mockCardV2.image_normal,
            image_flip: mockCardV2.image_flip,
            prices: mockCardV2.prices,
          },
          {
            name: mockCardV1.name,
            scryfall_id: mockCardV1.scryfall_id,
            oracle_id: mockCardV1.oracle_id,
            version: 'INV-1',
            image_normal: mockCardV1.image_normal,
            image_flip: mockCardV1.image_flip,
            prices: mockCardV1.prices,
          },
        ],
        'fire // ice': [
          {
            name: mockCardV2.name,
            scryfall_id: mockCardV2.scryfall_id,
            oracle_id: mockCardV2.oracle_id,
            version: 'MH2-1',
            image_normal: mockCardV2.image_normal,
            image_flip: mockCardV2.image_flip,
            prices: mockCardV2.prices,
          },
          {
            name: mockCardV1.name,
            scryfall_id: mockCardV1.scryfall_id,
            oracle_id: mockCardV1.oracle_id,
            version: 'INV-1',
            image_normal: mockCardV1.image_normal,
            image_flip: mockCardV1.image_flip,
            prices: mockCardV1.prices,
          },
        ],
      },
    });
  });

  it('should handle input both custom-card and real card', async () => {
    const customCard = createCustomCardDetails();
    const realCard = createCardDetails({
      name: 'Counterspell',
      scryfall_id: '12345678-1234-5678-1234-567812345678',
      oracle_id: '87654321-4321-8765-4321-876543218765',
      full_name: 'Counterspell [EMA-1]',
      image_normal: 'counterspell-image',
      image_flip: undefined,
      prices: { usd: 1.5 },
      released_at: '2016-06-10',
    });

    (cardFromId as jest.Mock)
      .mockReturnValueOnce(customCard)
      .mockReturnValueOnce(realCard)
      .mockReturnValueOnce(customCard)
      .mockReturnValueOnce(realCard);

    (getAllVersionIds as jest.Mock).mockReturnValueOnce(['custom-card']).mockReturnValueOnce([realCard.scryfall_id]);

    const res = await request(app).post('/cube/api/getversions').send(['custom-card', realCard.scryfall_id]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      dict: {
        counterspell: [
          {
            name: realCard.name,
            scryfall_id: realCard.scryfall_id,
            oracle_id: realCard.oracle_id,
            version: 'EMA-1',
            image_normal: realCard.image_normal,
            image_flip: realCard.image_flip,
            prices: realCard.prices,
          },
        ],
        'custom card': [
          {
            name: customCard.name,
            scryfall_id: customCard.scryfall_id,
            oracle_id: customCard.oracle_id,
            version: '-',
            image_normal: customCard.image_normal,
            image_flip: customCard.image_flip,
            prices: customCard.prices,
          },
        ],
      },
    });
  });

  it('should accept the backside id and include both back and front sides with the same multiple versions', async () => {
    const oracleId = '9f1b2c3d-4e5f-6789-abcd-0123456789ab';
    const frontV1Id = '6b1b3f9e-2c9e-4c5a-a9f2-1d6a7e8b9c0d';
    const backV1Id = `${frontV1Id}2`;
    const frontV2Id = '3f9a1b2c-4d5e-6f70-819a-b2c3d4e5f6a7';
    const backV2Id = `${frontV2Id}2`;

    const frontV1 = createCardDetails({
      name: 'Delver of Secrets',
      scryfall_id: frontV1Id,
      oracle_id: oracleId,
      full_name: 'Delver of Secrets [M11-1]',
      image_normal: 'front-image-1',
      image_flip: 'back-image-1',
      prices: { usd: 0.25 },
      released_at: '2011-01-01',
      isExtra: false,
    });

    const backV1 = createCardDetails({
      name: 'Insectile Aberration',
      scryfall_id: backV1Id,
      oracle_id: oracleId,
      full_name: 'Insectile Aberration [M11-1]',
      image_normal: 'back-image-1',
      image_flip: undefined,
      prices: { usd: 0.25 },
      released_at: '2011-01-01',
      isExtra: true,
    });

    const frontV2 = createCardDetails({
      name: 'Delver of Secrets',
      scryfall_id: frontV2Id,
      oracle_id: oracleId,
      full_name: 'Delver of Secrets [M18-1]',
      image_normal: 'front-image-2',
      image_flip: 'back-image-2',
      prices: { usd: 1.5 },
      released_at: '2018-01-01',
      isExtra: false,
    });

    const backV2 = createCardDetails({
      name: 'Insectile Aberration',
      scryfall_id: backV2Id,
      oracle_id: oracleId,
      full_name: 'Insectile Aberration [M18-1]',
      image_normal: 'back-image-2',
      image_flip: undefined,
      prices: { usd: 1.5 },
      released_at: '2018-01-01',
      isExtra: true,
    });

    // First call: fetching details for the input (back face)
    // Subsequent calls: fetching each version id returned by getAllVersionIds
    (cardFromId as jest.Mock)
      .mockReturnValueOnce(backV2) // initial call for provided back id
      .mockReturnValueOnce(frontV2)
      .mockReturnValueOnce(backV2)
      .mockReturnValueOnce(frontV1)
      .mockReturnValueOnce(backV1);

    // Both back and front versions are returned
    (getAllVersionIds as jest.Mock).mockReturnValueOnce([
      frontV2.scryfall_id,
      backV2.scryfall_id,
      frontV1.scryfall_id,
      backV1.scryfall_id,
    ]);

    const res = await request(app).post('/cube/api/getversions').send([backV2.scryfall_id]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: 'true',
      dict: {
        'delver of secrets': [
          {
            name: frontV2.name,
            scryfall_id: frontV2.scryfall_id,
            oracle_id: frontV2.oracle_id,
            version: 'M18-1',
            image_normal: frontV2.image_normal,
            image_flip: frontV2.image_flip,
            prices: frontV2.prices,
          },
          {
            name: frontV1.name,
            scryfall_id: frontV1.scryfall_id,
            oracle_id: frontV1.oracle_id,
            version: 'M11-1',
            image_normal: frontV1.image_normal,
            image_flip: frontV1.image_flip,
            prices: frontV1.prices,
          },
        ],
        'insectile aberration': [
          {
            name: backV2.name,
            scryfall_id: backV2.scryfall_id,
            oracle_id: backV2.oracle_id,
            version: 'M18-1',
            image_normal: backV2.image_normal,
            image_flip: backV2.image_flip,
            prices: backV2.prices,
          },
          {
            name: backV1.name,
            scryfall_id: backV1.scryfall_id,
            oracle_id: backV1.oracle_id,
            version: 'M11-1',
            image_normal: backV1.image_normal,
            image_flip: backV1.image_flip,
            prices: backV1.prices,
          },
        ],
      },
    });

    // Verify the calls
    expect(cardFromId).toHaveBeenNthCalledWith(1, backV2.scryfall_id);
    expect(getAllVersionIds).toHaveBeenCalledWith(backV2);
  });
});
