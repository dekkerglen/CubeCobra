const createClient = require('../util');
const PackageHash = require('./packageHash');

const FIELDS = {
  ID: 'Id',
  TITLE: 'Title',
  DATE: 'Date',
  OWNER: 'Owner',
  STATUS: 'Status',
  CARDS: 'Cards',
  VOTERS: 'Voters',
  KEYWORDS: 'Keywords',
};

const STATUSES = {
  APPROVED: 'a',
  SUBMITTED: 's',
};

const client = createClient({
  name: 'PACKAGE',
  partitionKey: FIELDS.ID,
  attributes: {
    [FIELDS.ID]: 'S',
  },
  FIELDS,
});

module.exports = {
  getById: async (id) => (await client.get(id)).Item,
  put: async (document) => {
    const hashRows = PackageHash.getHashRows(document);

    await client.put({
      ...document,
    });

    await PackageHash.batchPut(hashRows);
  },
  batchPut: async (documents) => client.batchPut(documents),
  createTable: async () => client.createTable(),
  convertPackage: (pack) => {
    return {
      [FIELDS.ID]: `${pack._id}`,
      [FIELDS.TITLE]: pack.title,
      [FIELDS.DATE]: pack.date.valueOf(),
      [FIELDS.OWNER]: `${pack.userid}`,
      [FIELDS.STATUS]: pack.approved ? STATUSES.APPROVED : STATUSES.SUBMITTED,
      [FIELDS.CARDS]: pack.cards,
      [FIELDS.VOTERS]: pack.voters.map((voter) => `${voter}`),
      [FIELDS.KEYWORDS]: pack.keywords,
    };
  },
  FIELDS,
};
