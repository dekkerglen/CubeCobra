const updateCubeDraftFormats = (cube) => {
  if (!cube) return null;

  const defaultPack = { filters: [], trash: 0, sealed: false, picksPerPass: 1 };

  cube.draft_formats = (cube.draft_formats || [])
    .map((draftFormat) => {
      if (!draftFormat) return null;
      if (!draftFormat.packs) {
        draftFormat.packs = [];
      } else if (typeof draftFormat.packs === 'string' || draftFormat.packs instanceof String) {
        const filters = JSON.parse(draftFormat.packs);
        draftFormat.packs = { ...defaultPack, filters };
      }
      return draftFormat;
    })
    .filter((x) => x);
  return cube;
};

const migrations = [{ version: 1, migration: updateCubeDraftFormats }];

module.exports = migrations;
