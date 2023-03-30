# CubeCobra

An open source web application for building, managing, and playtesting Magic: the Gathering cubes.

### Contributing

If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites

You will need to install NodeJS, Redis, and an IDE of your preference (I recommend VSCode). You can find the necessary resources here:

NodeJS: https://nodejs.org/en/download/


Redis Server: 
* Windows: https://github.com/microsoftarchive/redis
* Mac: `brew install redis`
* Linux: `apt-get install redis`

VSCode (strongly recommended, but not required): https://code.visualstudio.com/
ESLint Extension for VSCode: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint

VSCode (with the ESLint extension) is the recommended environment. When using this setup, make sure that your selected workspace is the root folder that you have cloned, this will ensure that the ESLint plugin can work with our linting rules. Using this plugin will make adhering to the linting rules significantly easier.

### Environment Variables

Environment variables are populated from the `.env` file. There is no `.env` file checked in, so the first thing you need to do is copy `.env_EXAMPLE` to `.env` and fill out the values. Cube Cobra uses several AWS resources, including S3, DynamoDB, and Cloudwatch. For development purposes, you will need to create an AWS account and insert your credentials into the `.env` file.

Here is a table on how to fill out the env vars:


| Variable Name | Description | Required? |
| --- | --- | --- |
| AWS_ACCESS_KEY_ID | The AWS access key for your account. | Yes |
| AWS_LOG_GROUP | The name of the AWS CloudWatch log group to use. | Yes |
| AWS_LOG_STREAM | The name of the AWS CloudWatch log stream to use. |  |
| AWS_REGION | The AWS region to use. | Yes |
| AWS_SECRET_ACCESS_KEY | The AWS secret access key for your account. | Yes |
| CUBECOBRA_VERSION | The version of Cube Cobra. |  |
| DATA_BUCKET | The name of the AWS S3 bucket to use. You will need to create this bucket in your account. | Yes |
| DOMAIN | The domain name of the server. Used for external redirects such as emails. | Yes |
| DOWNTIME_ACTIVE | Whether or not the site is in downtime mode. |  |
| DYNAMO_PREFIX | The prefix to use for DynamoDB tables. You can leave this as the default value | Yes |
| EMAIL_CONFIG_PASSWORD | The password for the email account to use for sending emails. |  |
| EMAIL_CONFIG_USERNAME | The username for the email account to use for sending emails. |  |
| ENV | The environment to run Cube Cobra in. | Yes |
| FLASKROOT | The URL of the Flask server. This server is what vends recommendations from our ML model. |  |
| HOST | The URL of the Cube Cobra server for the ML server to redirect to. |  |
| NITROPAY_ENABLED | Whether or not to enable NitroPay, our ad provider. |  |
| NODE_ENV | The environment to run Cube Cobra in. | Yes |
| PATREON_CLIENT_ID | The client ID for the Patreon OAuth app. |  |
| PATREON_CLIENT_SECRET | The client secret for the Patreon OAuth app. |  |
| PATREON_HOOK_SECRET | The secret for the Patreon webhook. |  |
| PATREON_REDIRECT | The redirect URL for the Patreon OAuth app. |  |
| PORT | The port to run Cube Cobra on. | Yes |
| REDIS_HOST | The URL of the Redis server. | Yes |
| REDIS_SETUP | Whether or not to setup the Redis server - this is needed for Redis but not for elasticache. |  |
| SECRET | A secret phrase for encryption. You can leave the default value. | Yes |
| SESSION_SECRET | A secret phrase for session encryption. You can leave the default value. | Yes |
| SESSION | The name of the session cookie. You can leave the default value. | Yes |
| TCG_PLAYER_PRIVATE_KEY | The private key for the TCGPlayer API. |  |
| TCG_PLAYER_PUBLIC_KEY | The public key for the TCGPlayer API. |  |
| CACHE_ENABLED | Whether or not to enable caching. |  |
| AUTOSCALING_GROUP | The name of the autoscaling group this instance is run in, used for the distributed cache. |  |
| CACHE_SECRET | The secret for the distributed cache. |  |



### Initial Setup

For the first setup, you will need to run:

```sh
npm install
node --max-old-space-size=4096 one_shot_scripts/createTables.js
node --max-old-space-size=4096 jobs/update_cards.js
```


If you are on Windows, you will need to set bash as your script shell:
You will need to make sure you have `bash` installed somewhere and run the following command [with your `bash` path in place of the path below].

    npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"

Then you can start the program like so:

    npm run devstart

You can now open up a browser and connect to the app through: http://localhost:8080. Despite the fact that node says it is running on port 5000, you should use port 8080 to connect.

Nodemon will restart the application anytime there is a change to a source file.


### Updating Card Definitions and Analytics

From the previous script, `jobs/update_cards` is what creates the card definitions. Running this script will pull the latest data from scryfall. If you want card analytics, you'll need to run the following scripts in this order:

```sh
node --max-old-space-size=4096 jobs/update_draft_history.js
node --max-old-space-size=4096 jobs/update_cube_history.js
node --max-old-space-size=4096 jobs/update_metadata_dict.js
node --max-old-space-size=4096 jobs/update_cards.js
```


# Concepts
### Cards
We keep all card definitions in large pre-processed files, so that nodes in production just need to download and load the files, and can fetch the latest files from S3 when they're ready. We do this because it's much faster to read from memory than to have to make requests to some other service anytime we need card data. An external process is responsible for updating the card definitions, and uploading to S3. This same process is also responsible for updating the card analytics, and data exports.

