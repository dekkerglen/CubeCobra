/* eslint-disable no-var */
import { MockDynamoClient } from '../jest.setup';

declare global {
  var mockDynamoClient: MockDynamoClient;
  var mockDynamoCreateClient: jest.Mock;
}

export {};
