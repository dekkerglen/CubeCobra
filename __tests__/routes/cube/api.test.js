const router = require('../../../routes/cube/api');
const request = require('supertest');
const express = require('express');
const app = express();
const dbSetup = require('../../helpers/dbTestSetup');

const Cube = require('../../../models/cube');
const cubefixture = require('../../../fixtures/examplecube');
const { buildIdQuery } = require('../../../serverjs/cubefn');
const carddb = require('../../../serverjs/cards');

const fixturesPath = 'fixtures';
const exampleCube = cubefixture.exampleCube;
const cubeID = exampleCube.shortID;

app.use('/', router);

let mongoServer;

beforeAll(async () => {
  mongoServer = await dbSetup.connect();
  await carddb.initializeCardDb(fixturesPath, true);
  await new Cube(cubefixture.exampleCube).save();
});

afterAll(async () => {
  await dbSetup.close(mongoServer);
  carddb.unloadCardDb();
});

test('cubelist', () => {
  return request(app)
    .get('/cubelist/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain; charset=utf-8')
    .expect((res) => {
      const lines = res.text
        .trim()
        .split('\n')
        .map((l) => l.trim());
      expect(lines[0]).toEqual('Acclaimed Contender');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});
