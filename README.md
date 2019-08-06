# CubeCobra
An open source web application for building, managing, and playtesting Magic the Gathering cubes.

### Contributing
If you are interested in contributing towards Cube Cobra, please read the [Contribution guidelines for this project](CONTRIBUTING.md).

# Setup

### Install Prerequisites
You will need to install NodeJS, MongoDB, and an IDE of your preference (I reccomend Atom). You can find the neccesary resources here:

NodeJS: https://nodejs.org/en/download/

MongoDB: https://docs.mongodb.com/manual/installation/

You will need start a MongoDB background process, and create a database titled 'nodecube'. Refer to the official documentation for directions on how to set this up for your OS.

Atom (optional): https://atom.io/

### Clone Project

Clone the project into a folder of your choice. Then, you will need to add a folder adjacent to the project folder like this:
  
    .
    ├── CubeCobra               # Cloned repository
    └── cubecobrasecrets        # Secrets folder    
        └── email.js            # Secrets file
        
In email.js, you can paste the following, and replace the fields with any gmail account you have access to. You only need to fill out these fields with real information if you need to create user account validation emails.

    module.exports =
    {
      username:'YOUR_EMAIL',
      password:'YOUR_PASSWORD'
    }

Then, run the following commands in the root of the cloned repository:

    npm install    
    npm install nodemon -g
    nodemon

You can now open up a browser and connect to the app through: http://localhost:5000

Nodemon will restart the application anytime there is a change to a source file.
