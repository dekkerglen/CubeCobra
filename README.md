# CubeCobra

An open source web application for building, managing, and playtesting Magic the Gathering cubes.

### Contributing

If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites

You will need to install NodeJS, MongoDB, and an IDE of your preference (I recommend VSCode). You can find the necessary resources here:

NodeJS: https://nodejs.org/en/download/

MongoDB: https://docs.mongodb.com/manual/installation/

You will need start a MongoDB background process. Refer to the official documentation for directions on how to set this up for your OS.

VSCode (strongly recommended, but not required): https://code.visualstudio.com/
ESLint Extension for VSCode: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint

VSCode (with the ESLint extension) is the recommended environment. When using this setup, make sure that your selected workspace is the root folder that you have cloned, this will ensure that the ESLint plugin can work with our linting rules. Using this plugin will make adhering to the linting rules significantly easier.

### Clone Project

Clone the project into a folder of your choice. 

You can either copy and rename the `cubecobrasecrets.example` folder outside the root folder such that the resulting directory structure looks like this:
```sh
.
├── CubeCobra               # Cloned repository
└── cubecobrasecrets        # link to `CubeCobra/cubecobrasecrets.example`
    └── email.js            # Email secrets file
    └── etc...
```

Or, you can create a symbolic link from `../cubecobrasecrets` to `cubecobrasecrets.example`:
```bash
cd CubeCobra/..
ln -s CubeCobra/cubecobrasecrets.example cubecobrasecrets
```


Then, run the following commands in the root of the cloned repository:

```sh
npm install
npm install nodemon -g
npm install rollup -g
npm run setup               # This will bundle modules and download Scryfall assets.
node seed.js                # This will create and seed the mongo database specified in cubecobrasecrets.
```

If you are on Windows, you will need to set bash as your script shell:
You will need to make sure you have `bash` installed somewhere and run the following command [with your `bash` path in place of the path below].

    npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"

Then you can start the program like so:

    npm start

You can now open up a browser and connect to the app through: http://localhost:8080. Despite the fact that node says it is running on port 5000, you should use port 8080 to connect.

Nodemon will restart the application anytime there is a change to a source file.

### Running tests

To run the test suite, run `npm run test`.

If you make changes to `updatecards.js` or other code that will require remaking the fixture files in `fixtures/` you can use the helper: `node update_fixtures.js` after getting the lastest card info using `node --max-old-space-size=4096 force_update.js`. This will retain the same cards in the fixtures but with updated card details and fixture files.

### Updating Card Definitions

The card definitions are cached locally for quick access. This definition is pulled from scryfall every 24 hours normally, but you can force an update with the command:
```
node --max-old-space-size=4096 force_update.js
```

### Adding Analytics

To build the analytics database objects, you need to run the script `populate_analytics.js`. You will likely need to add the `max-old-space-size` flag like so:
```
node --max-old-space-size=8192 populate_analytics.js
```

This will populate the data used for card pages. You will need to do a couple playtest drafts to seed some data for the analytics for this to work correctly. 
