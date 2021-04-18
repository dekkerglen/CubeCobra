const router = require('../../../routes/cube/download');
const request = require('supertest');
const express = require('express');
const app = express();
const dbSetup = require ('../../../serverjs/dbTestSetup');

const Cube = require('../../../models/cube');
const cubefixture = require('../../../fixtures/examplecube');
const { buildIdQuery } = require('../../../serverjs/cubefn');
const carddb = require('../../../serverjs/cards');

const fixturesPath = 'fixtures';
const cubeID = '2';

app.use('/', router);

let mongoServer;

beforeAll(async () => {
  mongoServer = await dbSetup.connect();
  await carddb.initializeCardDb(fixturesPath, true);
  const cube = new Cube(cubefixture.exampleCube);
  await cube.save();
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
    .expect(function(res) {
      // TODO: add more expectations
      expect(res.text).toEqual(expect.stringContaining('Acclaimed Contender [eld-1]'));
    })
})
