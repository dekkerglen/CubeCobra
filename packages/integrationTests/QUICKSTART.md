# Quick Start Guide - Integration Tests

Get up and running with CubeCobra integration tests in 5 minutes!

## 1. Install Dependencies

```bash
cd packages/integrationTests
npm install
npm run playwright:install
```

## 2. Configure Server for Testing

Before running tests, disable bot security in your local server:

```bash
# In packages/server/.env, add or update:
ENABLE_BOT_SECURITY=false
```

This disables captchas and security questions that would block automated tests.

## 4. Start Your Target Server

### For Local Testing

```bash
# In a separate terminal, start the CubeCobra server
cd packages/server
npm run dev
```

Wait for the server to start, then proceed.

## 3. Run Tests

```bash
# Back in integrationTests directory
npm run test:local
```

**Note:** Tests automatically generate unique usernames and test data for each run, so you can run them repeatedly against the same environment without conflicts!

Or test against other environments:

```bash
# Beta environment
npm run test:beta

# Production (smoke tests only)
npm run test:prod

# Custom URL
BASE_URL=https://your-instance.com npm test
```

## 5. View Results

After tests run, open the HTML report:

```bash
# Windows
start reports/cucumber-report.html

# Mac/Linux
open reports/cucumber-report.html
```

## Common Commands

```bash
# Test against local server
npm run test:local

# Test with browser visible
npm run test:headed

# Run only smoke tests
npm run test:smoke

# Run specific scenarios with tags
npx cucumber-js --tags "@smoke"
npx cucumber-js --tags "@auth"

# Generate test code with Playwright
npm run playwright:codegen:local

# Check if server is ready
node scripts/wait-for-services.js http://localhost:5000
```

## Environment Configuration

Create a `.env` file for persistent configuration:

```bash
cp .env.example .env
```

Edit `.env`:

```env
BASE_URL=http://localhost:5000
BROWSER=chromium
HEADED=false
```

Then simply run:

```bash
npm test
```

## Troubleshooting

### Server not running

```bash
# Make sure the server is started first:
cd ../server && npm run dev
```

### Tests can't connect

```bash
# Check if server is accessible
curl http://localhost:5000
```

### Browser not installed

```bash
npm run playwright:install
```

### Need more help?

See the full [README.md](README.md) for detailed documentation.

## Next Steps

1. Explore the example feature files in `features/`
2. Add your own scenarios
3. Write step definitions in `features/steps/`
4. Check out the [Gherkin reference](https://cucumber.io/docs/gherkin/reference/)

Happy Testing! 🎭🥒
