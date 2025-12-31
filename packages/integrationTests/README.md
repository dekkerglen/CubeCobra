
# CubeCobra Integration Tests

End-to-end integration tests for CubeCobra using Playwright.

## Overview

This package contains browser-based integration tests that verify the complete functionality of CubeCobra against any running instance (local, beta, or production).


## Features

- 🎭 **Playwright** - Modern, reliable browser automation
- 🌍 **Multi-Environment** - Test against local, beta, or production
- 📊 **HTML Reports** - Beautiful test result reports
- 📸 **Screenshots** - Automatic capture on test failures
- 🎥 **Videos** - Test execution recordings (on failure)

## Prerequisites

1. Node.js >= 22.0.0
2. A running CubeCobra instance (local server, beta, or production)
3. **For local testing:** Set `ENABLE_BOT_SECURITY=false` in the server's `.env` file to disable captchas and security questions

## Installation

```bash
# From the integrationTests directory
npm install

# Install Playwright browsers
npm run playwright:install
```

## Project Structure

```
integrationTests/
├── tests/                      # Playwright test files
├── scripts/                    # Utility scripts
├── scripts/                    # Utility scripts
│   ├── wait-for-services.js   # Service health check
│   └── generate-report.js     # Report generation
├── reports/                    # Test reports (generated)
│   ├── screenshots/           # Failure screenshots
│   └── cucumber-report.html   # HTML test report
├── logs/                      # Application logs (generated)
├── cucumber.js                # Cucumber configuration
├── playwright.config.ts       # Playwright configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Running Tests

### Against Different Environments

```bash
# Test against local development server (default: http://localhost:5000)
npm run test:local

# Test against beta environment
npm run test:beta

# Test against production (smoke tests only!)
npm run test:prod

# Test with custom URL
BASE_URL=https://your-instance.com npm test
```

### Development Mode

```bash
# Run with browser visible
npm run test:headed

# Run only smoke tests
npm run test:smoke

# Run smoke tests with visible browser
npm run test:smoke:headed
```

### Using .env File

Create a `.env` file from the example:
```bash
cp .env.example .env
```

Edit `.env` to set your target:
```env
BASE_URL=http://localhost:5000
BROWSER=chromium
HEADED=false
```

Then just run:
```bash
npm test
```


## Writing Tests

Write integration tests using Playwright's test runner in TypeScript. Place your test files in the `tests/` directory. Use Playwright's fixtures and assertions to interact with the application and verify behavior. Unique test data can be generated in test setup code as needed.


### Test Configuration

Target URL for tests (default: `http://localhost:5000`)
- `BROWSER` - Browser to use: `chromium`, `firefox`, or `webkit` (default: `chromium`)
- `HEADED` - Run with browser visible: `true` or `false` (default: `false`)
- `CI` - CI mode flag (affects retries and workers)

### Testing Against Different Environments

**Local Development:**
```bash
# Make sure your local server is running first
cd ../server && npm run dev

# In another terminal:
npm run test:local
```

**Beta Environment:**
```bash
npm run test:beta
```

**Production (Caution!):**
```bash
# Only runs smoke tests, avoids destructive operations
npm run test:prode: `true` or `false` (default: `false`)
- `CI` - CI mode flag (affects retries and workers)

Example:
```bash
BROWSER=firefox HEADED=true npm test
```


### Playwright Configuration

Edit [playwright.config.ts](playwright.config.ts) to customize:
- Timeouts
- Browser options
- Screenshot/video settings
- Test parallelization

## Reports


After running tests, reports are generated in the `reports/` directory:
- `screenshots/` - Screenshots of failed tests
- `videos/` - Test execution recordings

## Debugging

### Visual Debugging

Run tests in headed mode to see the browser:
```bash
npm run test:local:headed
```er Not Ready

If tests fail immediately, the target server may not be ready:
```bash
# Check if server is accessible
curl http://localhost:5000

# Or use the wait script
node scripts/wait-for-services.js http://localhost:5000
```

### Connection Refused

Make sure the target server is running:
```bash
# For local testing, start the server first:
cd ../server && npm run dev
```

### Browser Not Installed

Install Playwright browsers:
```bash
npm run playwright:install
```

### Tests Failing on Production

Production tests are limited to smoke tests only. Make sure you're using:
```bash
npm run test:prod  # Only runs @smoke tagged tests
### Port Already in Use

If the server port is in use:
```bash
npm run stop:services
# Or manually:
npx kinique test data is automatic** - Don't worry about username conflicts; the framework handles it
3. **Use meaningful tags** - Tag scenarios for easy filtering
4. **Write descriptive step definitions** - Steps should read like documentation
5. **Prefer API setup** - Use APIs for test data setup when possible (already implemented for login)
6. **Handle waits properly** - Use Playwright's auto-waiting, avoid fixed timeouts
7. **Clean up is automatic** - Test users and cubes are tracked and can be cleaned up via hooks
8. **Run smoke tests frequently** - Tag critical paths as @smoke
9. **Be careful with production** - Use `npm run test:prod` which only runs safe @smoke tests
```bash
npm run playwright:install
```

### LocalStack Issues

Restart LocalStack:
```bash
localstack stop
npm run start:localstack
```

## Best Practices

1. **Keep scenarios independent** - Each scenario should be able to run in isolation
2. **Use meaningful tags** - Tag scenarios for easy filtering
3. **Write descriptive step definitions** - Steps should read like documentation
4. **Prefer API setup** - Use APIs for test data setup when possible
5. **Handle waits properly** - Use Playwright's auto-waiting, avoid fixed timeouts
6. **Clean up after tests** - Use hooks to ensure proper cleanup
7. **Run smoke tests frequently** - Tag critical paths as @smoke


## Contributing

When adding new tests:
1. Write Playwright test files in TypeScript in the `tests/` directory
2. Use Playwright's fixtures and assertions
3. Update this README if adding new test categories

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Cucumber.js Documentation](https://github.com/cucumber/cucumber-js)
- [Gherkin Reference](https://cucumber.io/docs/gherkin/reference/)
- [LocalStack Documentation](https://docs.localstack.cloud/)

## License

ISC
