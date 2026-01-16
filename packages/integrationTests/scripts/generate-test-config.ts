#!/usr/bin/env node
import { faker } from '@faker-js/faker';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(__filename);

interface TestConfig {
  testUser: {
    username: string;
    email: string;
    password: string;
  };
}

/**
 * Generates a test configuration file with stable credentials for integration tests.
 * This ensures all test runs and retries use the same credentials.
 */
function generateTestConfig(): TestConfig {
  // Generate username with only alphanumeric characters
  const baseUsername = faker.internet.username().replace(/[^a-zA-Z0-9]/g, '');
  // Ensure it's at least 5 characters (minimum requirement)
  const username = baseUsername.length >= 5 ? baseUsername : baseUsername + faker.string.alphanumeric(5);

  const config: TestConfig = {
    testUser: {
      username: username.toLowerCase(),
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12, memorable: true }),
    },
  };

  return config;
}

function main() {
  const config = generateTestConfig();
  const configPath = join(__dirname, '..', 'test-config.json');

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log('✅ Test configuration generated successfully!');
  console.log(`📁 Config file: ${configPath}`);
  console.log(`👤 Test user: ${config.testUser.username}`);
  console.log(`📧 Test email: ${config.testUser.email}`);
  console.log(`🔑 Password length: ${config.testUser.password.length} characters`);
}

main();
