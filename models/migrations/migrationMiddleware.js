const applyPendingMigrationsPre = (migrations) => async (doc) => {
  const { schemaVersion } = doc;
  return migrations.reduce(
    (newDoc, { version, migration }) => (!schemaVersion || schemaVersion < version ? migration(newDoc) : newDoc),
    doc,
  );
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
