# CubeCobra

An open source web application for building, managing, and playtesting Magic the Gathering cubes.

### Contributing

If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites

You will need to install NodeJS, MongoDB, and an IDE of your preference (I reccomend Atom). You can find the neccesary resources here:

NodeJS: https://nodejs.org/en/download/

MongoDB: https://docs.mongodb.com/manual/installation/

You will need start a MongoDB background process, and create a database titled 'nodecube'. Refer to the official documentation for directions on how to set this up for your OS. Running 'use nodecube' in the mongo CLI is sufficient.

Atom (optional): https://atom.io/

### Clone Project

Clone the project into a folder of your choice. Copy `.env-EXAMPLE` to `.env` and fill out your personal tokens. **NOTE** `TCG_PLAYER_PUBLIC_KEY` and `TCG_PLAYER_PRIVATE_KEY` can be left blank.

Once your `.env` file is filled out, run the following commands in the root of the cloned repository:

```
npm install    
node force_update.js
npm start
```

You can now open up a browser and connect to the app through: http://localhost:5000

Nodemon will restart the application anytime there is a change to a source file.

### Running tests

To run the test suite, run `npm run test`
