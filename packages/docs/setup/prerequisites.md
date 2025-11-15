# Prerequisites

Before setting up CubeCobra, you'll need to install and configure several tools and accounts.

## Code Editor (IDE)

**VSCode** (strongly recommended): https://code.visualstudio.com/

### Recommended VSCode Extensions

- **ESLint Extension**: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint
- **Prettier Extension**: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode

When using VSCode, make sure your selected workspace is the root folder that you have cloned. This ensures the ESLint plugin can work with our linting rules. Prettier will automatically apply standard formatting to your code, making adherence to linting and code formatting rules significantly easier.

## reCAPTCHA Account

CubeCobra uses Google reCAPTCHA (V2) to combat spam in actions such as creating cubes. You'll need a free reCAPTCHA account (no credit card required) with 10,000 assertions per month.

### Setting up reCAPTCHA

1. Go to https://www.google.com/recaptcha/admin/create
2. Enter any label you wish (suggest "CubeCobraLocalDev")
3. Set "reCAPTCHA type" to V2, with "I'm not a robot" tickbox enabled
4. Enter "localhost" as the domain
5. If you have setup your local CubeCobra to be accessible under a non-localhost domain, include that domain as well
6. See example settings:
   ![Creating a reCAPTCHA site](../readme/reCAPTCHA-create.png)
7. Submit to generate your keys
8. Save the "Site key" and "Secret key" values - you'll need these for your `.env` file

## Docker

**Docker Desktop**: https://docs.docker.com/desktop/

For Windows users with WSL2: https://docs.docker.com/desktop/features/wsl/

**Note**: Allocate a minimum of 16GB of memory to Docker (whether in Docker Desktop or WSL2 settings).

## Optional Tools

### jq

[jq](https://jqlang.org/) is useful for working with JSON data, including CubeCobra's card catalogs.

Download and install from https://jqlang.org/download/

## Next Steps

After installing prerequisites, choose your setup method:

- [Docker Setup](./docker-setup.md) (Recommended)
- [Node.js Setup](./nodejs-setup.md) (Alternative)
