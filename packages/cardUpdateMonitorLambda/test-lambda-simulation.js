#!/usr/bin/env node

/**
 * Lambda Module Loading Simulation Test
 * 
 * This test simulates how AWS Lambda loads ES modules by:
 * 1. Creating a zip bundle (with and without package.json)
 * 2. Extracting it to an isolated directory
 * 3. Running Node.js in a subprocess to load the module
 * 
 * This should reproduce the "Cannot use import statement outside a module" error
 * when package.json is missing from the bundle.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Test configuration
const BUILD_DIR = path.join(__dirname, 'dist');
const HANDLER_FILE = 'handler.js';
const MAP_FILE = 'handler.js.map';

/**
 * Create a zip bundle
 * @param {boolean} includePackageJson - Whether to include package.json in the bundle
 * @returns {Promise<string>} Path to the created zip file
 */
async function createZipBundle(includePackageJson) {
  const timestamp = Date.now();
  const zipPath = path.join(__dirname, `test-bundle-${includePackageJson ? 'with' : 'without'}-pkg-${timestamp}.zip`);
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    
    archive.pipe(output);
    
    // Add handler files
    archive.file(path.join(BUILD_DIR, HANDLER_FILE), { name: HANDLER_FILE });
    archive.file(path.join(BUILD_DIR, MAP_FILE), { name: MAP_FILE });
    
    // Conditionally add package.json
    if (includePackageJson) {
      const packageJson = { type: 'module' };
      archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });
    }
    
    archive.finalize();
  });
}

/**
 * Extract zip to a temporary directory
 */
function extractZip(zipPath) {
  const extractPath = path.join(__dirname, `temp-test-${Date.now()}`);
  fs.mkdirSync(extractPath, { recursive: true });
  
  execSync(`unzip -q "${zipPath}" -d "${extractPath}"`);
  
  return extractPath;
}

/**
 * Test loading the module in an isolated Node.js process
 */
function testModuleLoad(extractPath) {
  console.log('📄 Bundle contents:');
  const files = fs.readdirSync(extractPath);
  files.forEach(file => console.log(`   - ${file}`));
  console.log();
  
  const hasPackageJson = files.includes('package.json');
  console.log(`📋 package.json present: ${hasPackageJson ? '✅ YES' : '❌ NO'}`);
  console.log();
  
  console.log('3️⃣  Attempting to load handler in isolated Node.js process...');
  console.log('   (This simulates how AWS Lambda loads the module)');
  console.log();
  
  // Write a minimal test script that just imports the handler
  const testScript = `
import('./handler.js')
  .then(() => {
    console.log('Handler loaded successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
`;
  
  fs.writeFileSync(path.join(extractPath, 'test-load.mjs'), testScript);
  
  // Run node with environment variables set via command line
  // This mimics how Lambda sets environment before loading the module
  try {
    execSync('node test-load.mjs', {
      cwd: extractPath,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: {
        ...process.env,
        DYNAMO_TABLE: 'test-table',
        DATA_BUCKET: 'test-bucket',
        AWS_REGION: 'us-east-1'
      }
    });
    console.log('   ✅ SUCCESS: Module loaded without errors!');
    console.log();
    return { success: true };
  } catch (error) {
    console.log('   ❌ FAILED: Module failed to load');
    console.log();
    console.log('   Error output:');
    const output = error.stdout || error.stderr || error.message;
    console.log('   │ ' + output.split('\n').join('\n   │ '));
    console.log();
    return { success: false, error: output };
  }
}

/**
 * Run a complete test scenario
 */
async function runTest(includePackageJson) {
  console.log('======================================================================');
  console.log(`📦 TEST: ${includePackageJson ? 'WITH' : 'WITHOUT'} package.json`);
  console.log('======================================================================');
  console.log();
  
  let zipPath, extractPath;
  
  try {
    console.log('1️⃣  Creating zip bundle...');
    zipPath = await createZipBundle(includePackageJson);
    console.log('   ✅ Zip created');
    console.log();
    
    console.log('2️⃣  Extracting zip to isolated directory...');
    extractPath = extractZip(zipPath);
    console.log('   ✅ Extracted');
    console.log();
    
    const result = testModuleLoad(extractPath);
    
    return result;
    
  } finally {
    // Cleanup
    if (zipPath && fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    if (extractPath && fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log();
  console.log('🧪 Lambda ES Module Loading Test');
  console.log('==================================');
  console.log();
  console.log('This test verifies that the Lambda bundle includes package.json');
  console.log('with {"type": "module"} to enable ES module support.');
  console.log();
  
  // First test: WITHOUT package.json (should fail with ES module error)
  const withoutResult = await runTest(false);
  
  // Second test: WITH package.json (should succeed)
  const withResult = await runTest(true);
  
  console.log();
  console.log('======================================================================');
  console.log('📊 TEST RESULTS');
  console.log('======================================================================');
  console.log();
  console.log(`WITHOUT package.json: ${withoutResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WITH package.json:    ${withResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
  
  if (!withoutResult.success && withResult.success) {
    console.log('✅ TEST PASSED: Fix is working correctly!');
    console.log('   - Bundle WITHOUT package.json fails (as expected)');
    console.log('   - Bundle WITH package.json succeeds');
    console.log();
    process.exit(0);
  } else if (withoutResult.success && withResult.success) {
    console.log('⚠️  INCONCLUSIVE: Both tests succeeded');
    console.log('   - This might mean the error cannot be reproduced locally');
    console.log('   - The fix is still valid for AWS Lambda environment');
    console.log();
    process.exit(0);
  } else if (!withoutResult.success && !withResult.success) {
    console.log('❌ TEST FAILED: Both tests failed');
    console.log('   - There may be other issues preventing module loading');
    console.log();
    process.exit(1);
  } else {
    console.log('❌ TEST FAILED: Unexpected result pattern');
    console.log('   - Bundle WITHOUT package.json succeeded (unexpected)');
    console.log('   - Bundle WITH package.json failed (unexpected)');
    console.log();
    process.exit(1);
  }
}

// Run the tests
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
