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
const exampleCube = cubefixture.exampleCube;
const cubeID = exampleCube.shortID;

app.use('/', router);

let mongoServer;

beforeAll(async () => {
  mongoServer = await dbSetup.connect();
  await carddb.initializeCardDb(fixturesPath, true);
  await new Cube(exampleCube).save();
});

afterAll(async () => {
  await dbSetup.close(mongoServer);
  carddb.unloadCardDb();
});

test('cubecobra text download', () => {
  return request(app)
    .get('/cubecobra/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.txt')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('Acclaimed Contender [eld-1]');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});

test('plaintext download', () => {
  return request(app)
    .get('/plaintext/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.txt')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('Acclaimed Contender');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});

test('MTGO download', () => {
  return request(app)
    .get('/mtgo/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.txt')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('1 Acclaimed Contender');
      expect(lines[1]).toEqual('2 Brazen Borrower');
      // The two Brazen Borrowers in the cube are deduped
      expect(lines.length).toEqual(exampleCube.cards.length - 1);
    });
});

test('csv download', () => {
  const headerLine =
    'Name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,Status,Finish,Maybeboard,Image URL,Image Back URL,Tags,Notes,MTGO ID';
  const faerieGuidemotherLine =
    '"Faerie Guidemother",1,"Creature - Faerie",W,"eld","11",common,w,Not Owned,Non-foil,false,,,"New","",78110,';

  return request(app)
    .get('/csv/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.csv')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual(headerLine);
      expect(lines[1]).toEqual(faerieGuidemotherLine);
      // Extra line expected for header
      expect(lines.length).toEqual(exampleCube.cards.length + 1);
    });
});

test('forge download', () => {
  return request(app)
    .get('/forge/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.dck')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('[metadata]');
      expect(lines[1]).toEqual('Name=' + exampleCube.name);
      expect(lines[2]).toEqual('[Main]');
      expect(lines[3]).toEqual('1 Acclaimed Contender|ELD');
      // Extra lines expected for [metadata] and [Main] headings, and cube name
      expect(lines.length).toEqual(exampleCube.cards.length + 3);
    });
});

test('xmage download', () => {
  return request(app)
    .get('/xmage/' + cubeID)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', 'attachment; filename=' + exampleCube.name + '.dck')
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('1 [ELD:1] Acclaimed Contender');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});

function splitText(text) {
  return text
    .trim()
    .split('\n')
    .map((l) => l.trim());
}
