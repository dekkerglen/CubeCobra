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
        const user = await User.findById('5cf9cdf2aefc6508c5ebcb40');
    
        console.log(user);
    
        const cursor =  Blog.find({owner: {$in: user.followed_users}}).cursor();
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