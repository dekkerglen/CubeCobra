import { faker } from '@faker-js/faker';

export interface TestUser {
  username: string;
  email: string;
  password: string;
}

let testUser: TestUser | null = null;

/**
 * Get or create a test user with consistent credentials for the test suite.
 * This ensures the same user is used across all tests that need authentication.
 */
export function getTestUser(): TestUser {
  if (!testUser) {
    testUser = {
      username: faker.internet.username(),
      email: faker.internet.email(),
      password: faker.internet.password({ length: 12, memorable: true }),
    };
  }
  return testUser;
}

/**
 * Reset the test user (useful for cleanup between test runs)
 */
export function resetTestUser(): void {
  testUser = null;
}
