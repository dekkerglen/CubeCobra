/* eslint-disable no-var */
import { MockDynamoClient } from '../jest.setup';

//Define additions to the global scope in our tests, so we know we can access shared mocks for mocking/expects
declare global {
  var mockDynamoClient: MockDynamoClient;
  var mockDynamoCreateClient: jest.Mock;
}

export {};
