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
    // Generate a unique username with timestamp to avoid conflicts
    const timestamp = Date.now();
    const randomId = faker.string.alphanumeric(6).toLowerCase();

    testUser = {
      username: `testuser${timestamp}${randomId}`,
      email: faker.internet.email().toLowerCase(),
      password: 'TestPassword123!',
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
