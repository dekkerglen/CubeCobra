const { mapNonNull } = require('../../serverjs/util');

const updateCubeDraftFormats = (cube) => {
  if (!cube) return null;
  const cubeObject = cube.toObject();

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
