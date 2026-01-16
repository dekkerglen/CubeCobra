import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(__filename);

export interface TestUser {
  username: string;
  email: string;
  password: string;
}

interface TestConfig {
  testUser: TestUser;
}

let testUser: TestUser | null = null;

/**
 * Load test configuration from the generated config file.
 * This file should be created by running the generate-test-config script before tests.
 */
function loadTestConfig(): TestUser {
  try {
    const configPath = join(__dirname, '..', 'test-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const config: TestConfig = JSON.parse(configData);
    return config.testUser;
  } catch (error) {
    throw new Error(
      'Test configuration file not found. Please run "npm run generate-test-config" before running tests.\n' +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the test user credentials from the configuration file.
 * This ensures the same user is used across all tests and retries.
 */
export function getTestUser(): TestUser {
  if (!testUser) {
    testUser = loadTestConfig();
  }
  return testUser;
}

/**
 * Reset the test user (useful for cleanup between test runs)
 */
export function resetTestUser(): void {
  testUser = null;
}
