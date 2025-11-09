# Docker Setup (Recommended)

Running CubeCobra within Docker is the simplest and fastest way to get everything up and running. For Windows users, we highly recommend running Docker using [Windows Subsystem for Linux 2 (WSL2)](https://learn.microsoft.com/en-us/windows/wsl/install) with Ubuntu (22.04 or above).

## Prerequisites

- [Docker Desktop installed](./prerequisites.md#docker)
- [reCAPTCHA account configured](./prerequisites.md#recaptcha-account)
- Minimum 16GB of memory allocated to Docker

## Initial Setup

For the first setup, you will need to run:

```sh
docker compose -f docker-compose.yml -f ./docker/init.yml up --abort-on-container-exit
```

**Note**: This can take tens of minutes to complete. When it finishes successfully you should see in the last docker logs output similar to the following (order of lines, and container name, may be different):

```
cubecobralocalstack  | 2025-10-27T21:47:56.503  INFO --- [et.reactor-0] localstack.request.aws     : AWS s3.UploadPart => 200
cubecobralocalstack  | 2025-10-27T21:47:58.803  INFO --- [et.reactor-1] localstack.request.aws     : AWS s3.CompleteMultipartUpload => 200
cubecobracube        | Finished comboDict.json
cubecobracube        | Uploading manifest...
cubecobralocalstack  | 2025-10-27T21:47:58.811  INFO --- [et.reactor-2] localstack.request.aws     : AWS s3.PutObject => 200
cubecobracube        | Finished manifest
cubecobracube        | done
cubecobracube        | Complete
cubecobralocalstack  | 2025-10-27T21:47:59.912  INFO --- [ead-7 (_run)] localstack_persist.state   : Persisting state of service s3...
cubecobracube exited with code 0
Aborting on container exit...
[+] Stopping 2/2
 ✔ Container cubecobracube        Stopped                                                                          0.0s
 ✔ Container cubecobralocalstack  Stopped
```

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

### What the Initial Setup Does

- Setup LocalStack with S3 bucket and SES email verified
- Install dependencies
- Download essential data files:
  - Card definitions from Scryfall API
  - ML model files for draft bots
  - Combo and interaction data
- Setup LocalStack DynamoDB tables (Users, Cubes, Cards, etc.)

Once setup is complete, the containers will exit gracefully. The card databases will be stored in `/packages/server/private/` and ML models in `/packages/server/model/`.

## Running CubeCobra

After initial setup, start the program with:

```sh
docker compose up
```

When the server is ready, you should see logs similar to:

```
cubecobracube        | Loaded private/carddict.json into _carddict
cubecobracube        | Loaded private/comboDict.json into comboDict
cubecobracube        | Finished loading carddb.
cubecobracube        | Server started on port 5000, listening on 127.0.0.1...
```

### What Running Does

- Ensure Nearley parsers for card filters have compiled
- Compile & watch SCSS (Bootstrap) styles
- Compile & watch server JavaScript with nodemon
- Run & watch webpack dev server

You can now open a browser and connect to: **http://localhost:8080**

*(Despite the logs showing port 5000, use port 8080 as that's what the webpack dev server listens on)*

Nodemon will restart the application when source files change.

## Account Registration

After accessing the application locally:

1. Create a new user account using the "Register" link in the nav bar
2. Run `bash scripts/extract-registration-email.sh` to print the registration URL you would have been emailed
3. Copy and open the URL to complete registration
4. Login with your username and password

## Running Commands in Docker Containers

With Docker running, you can execute commands within containers using `docker exec`:

### Common Commands

- **Install package**: `docker exec -it cube npm install`
- **Run npm build**: `docker exec -it cube npm run build`
- **Update cards script**: `docker exec -it cube npm run update-cards`
- **Check S3 bucket contents**: `docker exec -it localstack awslocal s3 ls s3://local`
- **Query users table**: `docker exec -it localstack awslocal dynamodb execute-statement --statement 'SELECT * FROM LOCAL_USERS'`

## Next Steps

- [Environment Variables](./environment-variables.md) - Configure additional settings
- [Updating Cards](../maintenance/updating-cards.md) - Keep card data current
- [Development Tools](../dev-tools.md) - Set up your development environment
