const { cardsNeedsCleaning, cleanCards } = require('./cleanCards');
const { mapNonNull } = require('../../serverjs/util');

const updateCubeDraftFormats = (cube) => {
  if (!cube) return null;
  const cubeObject = cube.toObject();
  if (!cube.cards) {
    cube.cards = [];
  }
  if (!Array.isArray(cube.basics)) {
    cube.basics = [
      '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
      '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
      '19e71532-3f79-4fec-974f-b0e85c7fe701',
      '8365ab45-6d78-47ad-a6ed-282069b0fabc',
      '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
    ];
  }
  if (cardsNeedsCleaning(cube.cards)) {
    cube.cards = cleanCards(cube.cards).map((card, index) => ({ ...card, index }));
  }
  if (cardsNeedsCleaning(cube.maybe)) {
    cube.maybe = cleanCards(cube.maybe).map((card, index) => ({ ...card, index }));
  }

  const newFormats = mapNonNull(cubeObject.draft_formats, (oldDraftFormat) => {
    if (!oldDraftFormat) return null;
    const draftFormat = {
      title: oldDraftFormat.title,
      multiples: oldDraftFormat.multiples,
      html: oldDraftFormat.html,
      markdown: oldDraftFormat.markdown,
      packs: oldDraftFormat.packs,
    };
    if (!draftFormat.packs) {
      draftFormat.packs = [];
    } else {
      let { packs } = draftFormat;
      packs = packs.map((pack) => {
        if (typeof pack === 'string' || pack instanceof String) {
          return pack;
        }
        return Object.values(pack).join('');
      });
      if (typeof draftFormat.packs === 'string' || draftFormat.packs instanceof String) {
        draftFormat.packs = packs.map((packStr) => ({ slots: JSON.parse(packStr), steps: null }));
      }
    }
    return draftFormat;
  }).filter((x) => x);
  cube.draft_formats = newFormats;
  return cube;
};

const migrations = [{ version: 1, migration: updateCubeDraftFormats }];

module.exports = migrations;
