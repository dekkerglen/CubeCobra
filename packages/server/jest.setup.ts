/// <reference types="jest" />
import path from 'path';

//Load the .env_EXAMPLE into the process environment variables for the tests
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(process.cwd(), '.env_EXAMPLE') });

//Mock the ML utility because when the file runs it tries to load all the models (which takes a while)
jest.mock('serverutils/ml', () => ({
  recommend: jest.fn(),
  build: jest.fn(),
  draft: jest.fn(),
  encode: jest.fn(),
}));

export interface MockDynamoClient {
  createTable: jest.Mock;
  get: jest.Mock;
  scan: jest.Mock;
  put: jest.Mock;
  query: jest.Mock;
  delete: jest.Mock;
  batchGet: jest.Mock;
  batchPut: jest.Mock;
  batchDelete: jest.Mock;
}

// Global mock client setup
const getMockClient = (): MockDynamoClient => ({
  createTable: jest.fn(),
  get: jest.fn(),
  scan: jest.fn(),
  put: jest.fn(),
  query: jest.fn(),
  delete: jest.fn(),
  batchGet: jest.fn(),
  batchPut: jest.fn(),
  batchDelete: jest.fn(),
});

const mockClient = getMockClient();
const mockCreateClient = jest.fn(() => mockClient);

//Assign the mocks to global so they can be accessed in any test by the name, in order to mock/expect on them
globalThis.mockDynamoClient = mockClient;
globalThis.mockDynamoCreateClient = mockCreateClient;

// Mock dynamo util module globally
jest.mock('src/dynamo/util', () => mockCreateClient);
