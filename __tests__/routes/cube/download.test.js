const request = require('supertest');
const express = require('express');
const Papa = require('papaparse');

const router = require('../../../routes/cube/download');
const Cube = require('../../../models/cube');
const carddb = require('../../../serverjs/cards');
const cubefixture = require('../../../fixtures/examplecube');
const dbSetup = require('../../helpers/dbTestSetup');

const splitText = (text) =>
  text
    .trim()
    .split('\n')
    .map((l) => l.trim());

const exampleCubeWithName = (name) => {
  const cube = new Cube(cubefixture.exampleCube);
  cube.name = name;
  return cube;
};

const fixturesPath = 'fixtures';
const cubeName = '"Galaxy Brain" Cube!!! :)';
const sanitizedCubeName = 'GalaxyBrainCube';
const exampleCube = exampleCubeWithName(cubeName);
const cubeID = exampleCube.shortID;

const app = express();
app.use('/', router);

let mongoServer;

beforeAll(async () => {
  mongoServer = await dbSetup.connect();
  await carddb.initializeCardDb(fixturesPath, true);
  await exampleCube.save();
});

afterAll(async () => {
  await dbSetup.close(mongoServer);
  carddb.unloadCardDb();
});

test('cubecobra text download', () => {
  return request(app)
    .get(`/cubecobra/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.txt`)
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('Faerie Guidemother [eld-11]');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});

test('plaintext download', () => {
  return request(app)
    .get(`/plaintext/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.txt`)
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('Faerie Guidemother');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});

test('MTGO download', () => {
  return request(app)
    .get(`/mtgo/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.txt`)
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('1 Faerie Guidemother');
      expect(lines[1]).toEqual('1 Giant Killer');
      // The two Brazen Borrowers in the cube are deduped
      expect(lines.length).toEqual(exampleCube.cards.length - 1);
    });
});

test('csv download', () => {
  const headerFields = [
    'Name',
    'CMC',
    'Type',
    'Color',
    'Set',
    'Collector Number',
    'Rarity',
    'Color Category',
    'Status',
    'Finish',
    'Maybeboard',
    'Image URL',
    'Image Back URL',
    'Tags',
    'Notes',
    'MTGO ID',
  ];

  const faerieGuidemotherData = {
    Name: 'Faerie Guidemother',
    CMC: '1',
    Type: 'Creature - Faerie',
    Color: 'W',
    Set: 'eld',
    'Collector Number': '11',
    Rarity: 'common',
    'Color Category': 'w',
    Status: 'Not Owned',
    Finish: 'Non-foil',
    Maybeboard: 'false',
    'Image URL': '',
    'Image Back URL': '',
    Tags: 'New',
    Notes: '',
    'MTGO ID': '78110',
  };

  return request(app)
    .get(`/csv/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.csv`)
    .expect((res) => {
      const parsed = Papa.parse(res.text.trim(), { header: true });
      expect(parsed.errors).toEqual([]);

      expect(parsed.meta.fields.sort()).toEqual(headerFields.sort());
      expect(parsed.data[0]).toEqual(faerieGuidemotherData);
      expect(parsed.data.length).toEqual(exampleCube.cards.length);
    });
});

test('forge download', () => {
  return request(app)
    .get(`/forge/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.dck`)
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('[metadata]');
      expect(lines[1]).toEqual(`Name=${exampleCube.name}`);
      expect(lines[2]).toEqual('[Main]');
      expect(lines[3]).toEqual('1 Faerie Guidemother|ELD');
      // Extra lines expected for [metadata] and [Main] headings, and cube name
      expect(lines.length).toEqual(exampleCube.cards.length + 3);
    });
});

test('xmage download', () => {
  return request(app)
    .get(`/xmage/${cubeID}`)
    .expect(200)
    .expect('Content-Type', 'text/plain')
    .expect('Content-disposition', `attachment; filename=${sanitizedCubeName}.dck`)
    .expect((res) => {
      const lines = splitText(res.text);
      expect(lines[0]).toEqual('1 [ELD:11] Faerie Guidemother');
      expect(lines.length).toEqual(exampleCube.cards.length);
    });
});
