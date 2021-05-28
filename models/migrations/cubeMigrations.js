const carddb = require('../../serverjs/cards');
const { mapNonNull } = require('../../serverjs/util');

const COLORS = ['W', 'U', 'B', 'R', 'G'];

const isInvalidCardId = (id) => carddb.cardFromId(id).name === 'Invalid Card';
const isInvalidFinish = (finish) => !['Foil', 'Non-foil'].includes(finish);
const isInvalidStatus = (status) => !['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].includes(status);
const isInvalidColors = (colors) => !colors || !Array.isArray(colors) || colors.some((c) => !COLORS.includes(c));
const isInvalidTags = (tags) => tags.some((t) => !t);
const DEFAULT_FINISH = 'Non-foil';
const DEFAULT_STATUS = 'Not Owned';
const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

const updateCubeDraftFormats = (cube) => {
  if (!cube) return null;
  const cubeObject = cube.toObject();
  if (!cube.cards) {
    cube.cards = [];
  }
  if (!cube.basics) {
    cube.basics = DEFAULT_BASICS;
  }
  cube.cards = cube.cards.filter((c) => c && !isInvalidCardId(c.cardID));
  cube.maybe = cube.maybe.filter((c) => c && !isInvalidCardId(c.cardID));
  for (const collection of [cube.cards, cube.maybe]) {
    for (const card of collection) {
      if (isInvalidFinish(card.finish)) card.finish = DEFAULT_FINISH;
      if (isInvalidStatus(card.status)) card.status = DEFAULT_STATUS;
      if (isInvalidColors(card.colors)) card.colors = carddb.cardFromId(card.cardID).color_identity;
      if (isInvalidTags(card.tags)) card.tags = card.tags.filter((t) => t);
    }
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
