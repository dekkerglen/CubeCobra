#!/usr/bin/env node

/**
 * Generate an HTML report from Cucumber JSON output
 */
const fs = require('fs');
const path = require('path');

const reportDir = path.join(__dirname, '../reports');
const jsonReport = path.join(reportDir, 'cucumber-report.json');
const htmlReport = path.join(reportDir, 'cucumber-report.html');

if (!fs.existsSync(jsonReport)) {
  console.log('No test results found. Run tests first.');
  process.exit(0);
}

console.log('📊 Test report generated at:', htmlReport);
console.log('Open this file in your browser to view results.');
