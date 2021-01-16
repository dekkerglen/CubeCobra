const { mapNonNull } = require('../../serverjs/util');

const updateCubeDraftFormats = (cube) => {
  if (!cube) return null;
  const cubeObject = cube.toObject();

  const defaultPack = Object.freeze({ filters: [], trash: 0, sealed: false, picksPerPass: 1 });

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
      draftFormat.packs = packs.map((packStr) => ({ ...defaultPack, filters: JSON.parse(packStr) }));
    }
    return draftFormat;
  }).filter((x) => x);
  cube.draft_formats = newFormats;
  return cube;
};

const migrations = [{ version: 1, migration: updateCubeDraftFormats }];

module.exports = migrations;
