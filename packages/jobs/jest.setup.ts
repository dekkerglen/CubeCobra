/// <reference types="jest" />
import dotenv from 'dotenv';
import path from 'path';

// Load the environment variables
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

// Set required environment variables for tests
process.env.DATA_BUCKET = 'test-data-bucket';

// Mock S3 utilities to avoid AWS SDK initialization
jest.mock('./src/utils/s3', () => ({
  downloadJson: jest.fn(),
  uploadJson: jest.fn(),
  listFiles: jest.fn(() => Promise.resolve([])),
}));

// Mock the entire cardCatalog module to completely avoid loading
jest.mock('@server/serverutils/cardCatalog', () => ({
  initializeCardDb: jest.fn(() => Promise.resolve()),
  loadJSONFile: jest.fn(() => Promise.resolve()),
  carddb: {
    allOracleIds: jest.fn(() => []),
    cardFromId: jest.fn(),
  },
}));

// Mock carddb separately
jest.mock('@server/serverutils/carddb', () => ({
  initializeCardDb: jest.fn(() => Promise.resolve()),
  loadJSONFile: jest.fn(() => Promise.resolve()),
  carddb: {
    allOracleIds: jest.fn(() => []),
    cardFromId: jest.fn(),
  },
}));

// Mock the DAOs to avoid database connections
jest.mock('@server/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getAllIds: jest.fn(() => []),
  },
  draftDao: {
    getById: jest.fn(),
    queriesByIndexBeginsWith: jest.fn(() => []),
    queryByTypeAndDateRangeUnhydrated: jest.fn(() => Promise.resolve([])),
  },
}));
