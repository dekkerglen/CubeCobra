/// <reference types="jest" />
import dotenv from 'dotenv';
import path from 'path';

//Load the .env_EXAMPLE into the process environment variables for the tests

dotenv.config({ path: path.resolve(process.cwd(), '.env_EXAMPLE') });

//Mock the ML utility because when the file runs it tries to load all the models (which takes a while)
jest.mock('serverutils/ml', () => ({
  recommend: jest.fn(),
  build: jest.fn(),
  draft: jest.fn(),
  encode: jest.fn(),
}));

//Mock the patreon module to avoid issues with undefined imports in tests
jest.mock('patreon', () => ({
  patreon: jest.fn(() => jest.fn()),
  oauth: jest.fn(() => ({
    getTokens: jest.fn(),
  })),
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

// Define to make typescript happy
declare global {
  // eslint-disable-next-line no-var
  var mockDynamoClient: MockDynamoClient;
  // eslint-disable-next-line no-var
  var mockDynamoCreateClient: () => MockDynamoClient;
}

//Assign the mocks to global so they can be accessed in any test by the name, in order to mock/expect on them
globalThis.mockDynamoClient = mockClient;
globalThis.mockDynamoCreateClient = mockCreateClient;

// Mock dynamo util module globally
jest.mock('src/dynamo/util', () => mockCreateClient);
