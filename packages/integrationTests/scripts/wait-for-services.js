#!/usr/bin/env node

/**
 * Check if the target server is ready before running tests
 * Usage: node wait-for-server.js [url]
 */
const fetch = require('node-fetch');

const TARGET_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:5000';
const MAX_WAIT_TIME = 120000; // 2 minutes
const CHECK_INTERVAL = 2000; // 2 seconds

async function checkServer(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function waitForServer() {
  console.log(`⏳ Waiting for server at ${TARGET_URL}...`);

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    if (await checkServer(TARGET_URL)) {
      console.log(`✅ Server is ready at ${TARGET_URL}`);
      process.exit(0);
    }

    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  console.error(`❌ Timeout waiting for server at ${TARGET_URL}`);
  console.error(`Make sure the server is running and accessible.`);
  process.exit(1);
}

waitForServer();
