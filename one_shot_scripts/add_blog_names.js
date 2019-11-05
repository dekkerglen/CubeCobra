const mongoose = require('mongoose');
const Blog = require('../models/blog');
const Cube = require('../models/cube');
const User = require('../models/user');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
const {
	generate_short_id,
} = require('../serverjs/cubefn.js');

(async () => {
    var i = 0;
	mongoose.connect(mongosecrets.connectionString).then( async (db) => {
    
		const cursor = Blog.find().cursor();
        for (let blog = await cursor.next(); blog != null; blog = await cursor.next()) {
            console.log(i++);
            const cube = await Cube.findById(blog.cube);
            const user = await User.findById(blog.owner);
            blog.cubename = cube ? cube.name : 'Cube';
            blog.username = user ? user.username : 'User';
            await blog.save();
        }
        mongoose.disconnect();
        console.log("done");
	});
})();