# Node.js Setup

This guide covers running CubeCobra directly with Node.js, which requires manual installation of NodeJS and LocalStack, plus completing the initial setup steps.

## Prerequisites

- [All general prerequisites](./prerequisites.md)
- Node.js 20+
- LocalStack
- AWS Local CLI

## Node.js Installation

**Node.js 20**: https://nodejs.org/en/download/

## LocalStack Installation

[LocalStack](https://www.localstack.cloud/) provides local emulation of AWS Services required by CubeCobra including S3, DynamoDB, Simple Email Service, and CloudWatch.

### Installation by Platform

- **Windows**: Download and install the binary from LocalStack
- **Mac**: `brew install localstack/tap/localstack-cli`
- **Linux**: Use the `curl` command from LocalStack

Follow the installation guidelines from the [LocalStack site](https://www.localstack.cloud/). The recommended setup involves running LocalStack in a Docker container, which requires [Docker Desktop](./prerequisites.md#docker).

### Starting LocalStack

Start the server in the background: `localstack start --detached`

Check status: `localstack status`

**Note**: LocalStack community edition (without a pro account) does not persist data when the container is stopped.

## AWS Local CLI Installation

The [awslocal CLI](https://github.com/localstack/awscli-local) is required for initial setup of LocalStack resources.

### Requirements

- Python 3.3+
- pip3

### Installation Steps (Linux Example)

1. **Install Virtual Environment**: `sudo apt-get install python3-venv`
2. **Navigate to CubeCobra directory**: `cd /path/to/cubecobra`
3. **Create virtual environment**: `python3 -m venv ./venv`
4. **Activate virtual environment**: `source ./venv/bin/activate`
5. **Install awslocal**: `pip3 install "awscli-local[ver1]"`
6. **Validate installation**: `awslocal --version`
   - Should print an "aws-cli" version (likely 1.X)
7. **Deactivate virtual environment**: `deactivate`

### Optional: Add to PATH

Add `$(pwd)/venv/bin` to your PATH so you can execute `awslocal` easily. Otherwise, run commands as `./venv/bin/awslocal ...`

## Initial Setup

Run the complete setup process:

```sh
npm install && npm run build
npm run setup:local
```

**Note**: This can take tens of minutes to complete.

### What Setup Does

- Install dependencies
- Create a `.env` file with values for running locally
- Setup LocalStack with S3 bucket
- Setup local files for application persistence  
- Setup LocalStack DynamoDB tables (Users, Cubes, Cards, etc.)

## First-Time Data Download

**⚠️ Important**: On your very first installation, you need to download the essential data files:

```sh
npm run download-data-files
```

This downloads:
- **Card definitions** (~100MB): Complete Magic card database from Scryfall
- **ML model files** (~500MB): AI models for draft bots and recommendations
- **Combo data**: Card interaction and synergy information

**This step is only required once** during initial setup. The data files will be saved to:
- `/packages/server/private/` - Card definitions and metadata
- `/packages/server/model/` - ML model files for AI features

### Windows-Specific Configuration

If you're on Windows, set bash as your script shell:

```sh
npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"
```

*(Adjust the path to match your bash installation)*

## Running CubeCobra

Start the development server:

```sh
npm run start:dev
```

### What This Does

- Ensure LocalStack is running
- Ensure Nearley parsers for card filters have compiled
- Compile & watch SCSS (Bootstrap) styles
- Compile & watch server JavaScript with nodemon
- Run & watch webpack dev server

Connect to the app at: **http://localhost:8080**

*(Despite logs showing port 5000, use port 8080 for the webpack dev server)*

Nodemon will restart the application when source files change.

## Account Registration

Follow the same [registration process](./docker-setup.md#account-registration) as the Docker setup.

## LocalStack Email Setup

If you're not using Docker and have `LOCALSTACK_SES="true"` in your `.env` file:

1. **Verify email for SES**:
   ```sh
   ./venv/bin/awslocal ses verify-email-identity --email 'support@cubecobra.com'
   ```

2. **Fetch emails from LocalStack**:
   ```sh
   curl --silent 'localhost.localstack.cloud:4566/_aws/ses?email=support@cubecobra.com' | jq .
   ```

## Next Steps

- [Environment Variables](./environment-variables.md) - Configure additional settings
- [AWS Configuration](./aws-configuration.md) - Connect to real AWS instead of LocalStack
- [Updating Cards](../maintenance/updating-cards.md) - Keep card data current
