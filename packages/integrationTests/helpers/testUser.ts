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
    // Generate username with only alphanumeric characters
    const baseUsername = faker.internet.username().replace(/[^a-zA-Z0-9]/g, '');
    // Ensure it's at least 5 characters (minimum requirement)
    const username = baseUsername.length >= 5 ? baseUsername : baseUsername + faker.string.alphanumeric(5);

    testUser = {
      username: username.toLowerCase(),
      email: faker.internet.email().toLowerCase(),
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
