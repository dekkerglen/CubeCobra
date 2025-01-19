# CubeCobra

An open source web application for building, managing, and playtesting Magic: the Gathering cubes.

### Contributing

If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites

You will need to install NodeJS, Redis, and an IDE of your preference (I recommend VSCode). You can find the necessary resources here:

### NodeJS

Node 20

NodeJS: https://nodejs.org/en/download/

### Redis

Redis Server:

- Windows: https://github.com/microsoftarchive/redis
- Mac: `brew install redis`
- Linux: `apt-get install redis`

After installing redis, start the server. On mac, a shortcut to do this is `brew services start redis`. You can seet the status with `brew services list`.

### Localstack

[Localstack][localstack] provides a local emulation of AWS Services required to run CubeCobra including S3, DynamoDB and Cloudwatch.

You may follow the installation guidelines from the localstack site. The recommended setup involves running localstack in a docker container, which requires [Docker Desktop][docker] as well.

- Windows: Download and install the binary from localstack
- Mac: `brew install localstack/tap/localstack-cli`
- Linux: Use the `curl` command from localstack

[localstack]: https://docs.localstack.cloud/getting-started/installation/
[docker]: https://docs.docker.com/desktop/install/mac-install/

Once localstack is installed, you can start the server in the background with the CLI: `localstack start --detached`. You can see the status with `localstack status`.

*Note*: Localstack community edition (eg. without a pro account) does not persist anything to disk once the container is stopped.

#### AWSLocal CLI (for Localstack)

The awslocal CLI used by this project (https://github.com/localstack/awscli-local) is required for initial setup of the localstack resources used by Cube Cobra.

First install Python (suggest Python 3) and pip for your operating system. Sample instructions for a linux environment are:
- Ensure Virtual environment package is installed: `sudo apt-get install python3-venv`
- Create a virtual environment in your home directory: `python3 -m venv ~/venv`
- Add the virtual environment to your path: `export PATH=~/venv/bin:$PATH`
- Also add to your startup profile script (eg. bash profile) the activation of the virtual environment: `source ~/venv/bin/activate`
- Install awslocal: `pip3 install "awscli-local[ver1]"`
- Validate install: `awslocal --version`
  - Will pass and print some "aws-cli" version (likely 1.X) for the system


### Code Editor (IDE)

VSCode (strongly recommended, but not required): https://code.visualstudio.com/
ESLint Extension for VSCode: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint
Prettier Extension for VSCode: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode

VSCode (with the ESLint and Prettier extension) is the recommended environment. When using this setup, make sure that your selected workspace is the root folder that you have cloned, this will ensure that the ESLint plugin can work with our linting rules. Prettier will automatically apply standard formatting to your code. Using these plugins will make adhering to the linting and code formatting rules significantly easier.

### Initial Setup

For the first setup, you will need to run:

```sh
npm install && npm run build
npm run setup:local
```

This will:
- install dependencies
- build the application code to run setup scripts
- run setup scripts to:
  - create a .env file with values for running the application locally already set
  - setup localstack w/ s3 bucket
  - setup local files for application perisistence
  - setup localstack dynamodb tables (ex. Users, Cubes, Cards, etc.)
  - download bulk card data from scryfall, persist to files and load it to localstack s3

If you are on Windows, you will need to set bash as your script shell:

You will need to make sure you have `bash` installed somewhere and run the following command [with your `bash` path in place of the path below].

```sh
npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"
```

### reCAPTCHA account

To combat spam CubeCobra uses Google reCAPTCHA (V2) in actions such as creating cubes. Thus in order to use the site locally
you must have a reCAPTCHA account, which thankfully are free (no credit card needed) with 10,000 assertions a month. To setup the
account follow these steps:

1. Go to https://www.google.com/recaptcha/admin/create
2. Enter any label you wish (suggest CubeCobraLocalDev)
3. Set "reCAPTCHA type" to V2, with "I'm not a robot" tickbox enabled
4. Enter "localhost" as the domain
  1. If you have setup your local CubeCobra to be accessible under a non-localhost domain (see [Running CubeCobra](#running-cubecobra)) then include that domain as well
5. Close the "Google Cloud Platform" section, as GCP is not required
6. Save. See screenshot as an example of the desired settings:
  ![Creating a reCAPTCHA site](./docs/readme/reCAPTCHA-create.png)
7. The generated "Site key" and "Secret key" values will be shown (You can always get these again from the reCAPTCHA settings if necessary). Use them to update your local .env file accordingly:
  1. Edit your .env file (which was created created during [Initial Setup](#initial-setup))
  2. Paste the value of the "Site key" as the value of the CAPTCHA_SITE_KEY environment variable
  3. Paste the value of the "Secret key" as the value of the CAPTCHA_SECRET_KEY environment variable
  4. Save the .env file changes



### Running CubeCobra

Then you can start the program like so:

```sh
npm run start:dev
```

This script will:
- ensure localstack is running
- ensure nearly parsers for card filters have compiled
- compile & watch scss (bootstrap) styles
- compile & watch server javascript w/ nodemon
- run & watch webpack dev server

You can now open up a browser and connect to the app through: http://localhost:8080.

(Despite the fact that node says it is running on port 5000 in the logs, you should use port 8080 to connect.)

Nodemon will restart the application anytime there is a change to a source file.

After accessing the application locally you will need to create a new user account using the "Resister" link on the nav bar.

### Environment Variables & Connecting to AWS

Environment variables are populated from the `.env` file. There is no `.env` file checked in, so the setup script copies `.env_EXAMPLE` to `.env` and with some default values to support CubeCobra backed by LocalStack.

You can run a local instance of Cube Cobra against real AWS resources rather than LocalStack, if desired. After setting up S3, DynamoDB, and Cloudwatch using your AWS account, you can insert your credentials into the `.env` file.

Here is a table on how to fill out the env vars:

| Variable Name          | Description                                                                                  | Required? |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------- |
| AWS_ACCESS_KEY_ID      | The AWS access key for your account.                                                         | Yes       |
| AWS_ENDPOINT           | The base endpoint to use for AWS. Used to point to localstack rather than hosted AWS.        |           |
| AWS_LOG_GROUP          | The name of the AWS CloudWatch log group to use.                                             | Yes       |
| AWS_LOG_STREAM         | The name of the AWS CloudWatch log stream to use.                                            |           |
| AWS_REGION             | The AWS region to use  (default: us-east-2).                                                 | Yes       |
| AWS_SECRET_ACCESS_KEY  | The AWS secret access key for your account.                                                  | Yes       |
| CUBECOBRA_VERSION      | The version of Cube Cobra.                                                                   |           |
| DATA_BUCKET            | The name of the AWS S3 bucket to use. You will need to create this bucket in your account.   | Yes       |
| DOMAIN                 | The domain name of the server. Used for external redirects such as emails.                   | Yes       |
| DOWNTIME_ACTIVE        | Whether or not the site is in downtime mode.                                                 |           |
| DYNAMO_PREFIX          | The prefix to use for DynamoDB tables. You can leave this as the default value               | Yes       |
| EMAIL_CONFIG_PASSWORD  | The password for the email account to use for sending emails.                                |           |
| EMAIL_CONFIG_USERNAME  | The username for the email account to use for sending emails.                                |           |
| ENV                    | The environment to run Cube Cobra in.                                                        | Yes       |
| NITROPAY_ENABLED       | Whether or not to enable NitroPay, our ad provider.                                          |           |
| NODE_ENV               | The environment to run Cube Cobra in.                                                        | Yes       |
| PATREON_CLIENT_ID      | The client ID for the Patreon OAuth app.                                                     |           |
| PATREON_CLIENT_SECRET  | The client secret for the Patreon OAuth app.                                                 |           |
| PATREON_HOOK_SECRET    | The secret for the Patreon webhook.                                                          |           |
| PATREON_REDIRECT       | The redirect URL for the Patreon OAuth app.                                                  |           |
| PORT                   | The port to run Cube Cobra on.                                                               | Yes       |
| REDIS_HOST             | The URL of the Redis server.                                                                 | Yes       |
| REDIS_SETUP            | Whether or not to setup the Redis server - this is needed for Redis but not for elasticache. |           |
| SECRET                 | A secret phrase for encryption. You can leave the default value.                             | Yes       |
| SESSION_SECRET         | A secret phrase for session encryption. You can leave the default value.                     | Yes       |
| SESSION                | The name of the session cookie. You can leave the default value.                             | Yes       |
| TCG_PLAYER_PRIVATE_KEY | The private key for the TCGPlayer API.                                                       |           |
| TCG_PLAYER_PUBLIC_KEY  | The public key for the TCGPlayer API.                                                        |           |
| CAPTCHA_SITE_KEY       | The reCAPTCHA site key                                                                       | Yes       |
| CAPTCHA_SECRET_KEY     | The reCAPTCHA secret key                                                                     | Yes       |
| DRAFTMANCER_API_KEY    | The Draftmancer API key                                                                      | Yes       |

### Updating Card Definitions and Analytics

In the initial setup scripts, `npm run update-cards` is what creates the card definitions. Running this script will pull the latest data from scryfall.

If you want card analytics, can run the following script:

```sh
npm run update-all
```

This will, in sequence:
- update draft history
- update cube history
- update metadata dictionary
- update cards

# Concepts

## Backend

### API & Template Rendering

[Express 4][express] provides a minimalist web framework to support both template rendering with [PugJS 3][pug] and definition of JSON-based API endpoints. HTML templates are mainly used to render a minimal page for React to bootstrap itself into with initial props injected from the server.

[express]: https://expressjs.com/en/4x/api.html

[pug]: https://pugjs.org/api/getting-started.html

### Cards

We keep all card definitions in large pre-processed files, so that nodes in production just need to download and load the files, and can fetch the latest files from S3 when they're ready. We do this because it's much faster to read from memory than to have to make requests to some other service anytime we need card data.

An external process is responsible for updating the card definitions, and uploading to S3. This same process is also responsible for updating the card analytics, and data exports.

### Scheduled jobs

Each instance of the express server runs a job using node-schedule on a nightly basis to update the in-memory carddb from s3.

Bash scripts (`jobs/definition`) are executed periodically on AWS to run hourly, daily & weekly jobs.

### Card Filters

Card filters are defined that can be used by the frontend and backend. [Nearley][nearly] is a nodejs parser toolkit that is used to generate code that define filters that can be applied to the card database.

[nearly]: https://nearley.js.org/

## Frontend

### Typescript

[TypeScript 5.5][typescript] is gradually being rolled out to replace usage of vanilla JS components with PropTypes.

[typescript]: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html

### Components & Styling

Components are styled using TailwindCSS, with some custom CSS for more complex components.
