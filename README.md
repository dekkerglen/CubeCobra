# CubeCobra

An open source web application for building, managing, and playtesting Magic the Gathering cubes.

### Contributing

If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites

You will need to install NodeJS, MongoDB, and an IDE of your preference (I recommend Atom). You can find the necessary resources here:

NodeJS: https://nodejs.org/en/download/

MongoDB: https://docs.mongodb.com/manual/installation/

You will need start a MongoDB background process. Refer to the official documentation for directions on how to set this up for your OS.

Atom (optional): https://atom.io/

### Clone Project

Clone the project into a folder of your choice. Create a symbolic link from
`../cubecobrasecrets` to `cubecobrasecrets.example`:

```bash
cd CubeCobra/..
ln -s CubeCobra/cubecobrasecrets.example cubecobrasecrets
```

It's important that the resulting directory structure looks like this:

```sh
.
├── CubeCobra               # Cloned repository
└── cubecobrasecrets        # link to `CubeCobra/cubecobrasecrets.example`
    └── email.js            # Email secrets file
    └── etc...
```

Then, run the following commands in the root of the cloned repository:

```sh
npm install
npm install nodemon -g
npm install rollup -g
npm run setup               # This will bundle modules and download Scryfall assets.
node seed.js                # This will create and seed the mongo database specified in cubecobrasecrets.

# Linux/OSX users
npm start                   # Start nodemon for backend server and webpack for frontend assets.

# Windows users will need to use 2 terminal instances.
npm nodemon
npm run-script webpack-dev-server
```

Alternatively, if you are on Windows, you can use bash to mimic the Linux/OSX steps:
You will need to make sure you have `bash` installed somewhere and run the following command [with your `bash` path in place of the path below].

    npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"

Then you can start the program like so:

    npm start

You can now open up a browser and connect to the app through: http://localhost:8080. Despite the fact that node says it is running on port 5000, you should use port 8080 to connect.

Nodemon will restart the application anytime there is a change to a source file.

### Running tests

To run the test suite, run `npm run test`.

If you make changes to `updatecards.js` or other code that will require remaking the fixture files in `fixtures/` you can use the helper: `node update_fixtures.js` after getting the lastest card info using `node force_update.js`. This will retain the same cards in the fixtures but with updated card details and fixture files.
