const applyPendingMigrationsPre = (migrations) => async (doc) => {
  if (!doc) return doc;
  const { schemaVersion } = doc;
  let newDoc = doc;
  for (const { version, migration } of migrations) {
    if ((!schemaVersion && schemaVersion !== 0) || schemaVersion < version) {
      // eslint-disable-next-line no-await-in-loop
      newDoc = await migration(newDoc);
      if (!newDoc) return newDoc;
    }
  }
  newDoc.schemaVersion = migrations.slice(-1)[0].version;
  return newDoc;
};

const withMigrations = (schema, migrations) => {
  const [{ version: latestVersion }] = migrations.slice(-1);

  schema.add({ schemaVersion: Number });

  const applyPendingMigrations = applyPendingMigrationsPre(migrations);

  schema.post('find', (docs) => Promise.all(docs.map(applyPendingMigrations)));
  schema.post('findOne', applyPendingMigrations);

  schema.pre('save', () => {
    this.schemaVersion = latestVersion;
  });

  return schema;
};

module.exports = { withMigrations, applyPendingMigrationsPre };
