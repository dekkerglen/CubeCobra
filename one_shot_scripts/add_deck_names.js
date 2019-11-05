const mongoose = require('mongoose');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const User = require('../models/user');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
const {
	generate_short_id,
} = require('../serverjs/cubefn.js');

(async () => {
    var i = 0;
	mongoose.connect(mongosecrets.connectionString).then( async (db) => {
        const cubes = await Cube.find({owner: "5cf9cdf2aefc6508c5ebcb40"});
    
        const cubeIds = [];
        cubes.forEach(function(cube, index)
        {
          cubeIds.push(cube._id);
        });
    
		const cursor = Deck.find({cube: {$in: cubeIds}}).cursor();
        for (let deck = await cursor.next(); deck != null; deck = await cursor.next()) {
            console.log(i++);
            const cube = await Cube.findById(deck.cube);
            const user = await User.findById(deck.owner);
            deck.cubename = cube ? cube.name : 'Cube';
            deck.username = user ? user.username : 'User';
            await deck.save();
        }
        mongoose.disconnect();
        console.log("done");
	});
})();