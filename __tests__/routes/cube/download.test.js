const router = require('../../../routes/cube/download');
const request = require('supertest');
const express = require('express');
const app = express();
const dbSetup = require('../../helpers/dbTestSetup');

const Cube = require('../../../models/cube');
const cubefixture = require('../../../fixtures/examplecube');
const { buildIdQuery } = require('../../../serverjs/cubefn');
const carddb = require('../../../serverjs/cards');

const fixturesPath = 'fixtures';
const cubeID = cubefixture.exampleCube.shortID;

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

test('text download', () => {
  return request(app)
    .get('/cubecobra/' + cubeID)
    .expect('Content-Type', 'text/plain')
    .expect(200)
    .expect(function (res) {
      // TODO: add more expectations
      expect(res.text).toEqual(expect.stringContaining('Acclaimed Contender [eld-1]'));
    });
});
