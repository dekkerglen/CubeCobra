const mongoose = require('mongoose');
const Cube = require('../models/cube');
const config = require('../config/database');
const {
	generate_short_id,
} = require('../serverjs/cubefn.js');

function update_short_ids(cubes) {
	if (!cubes.length) {
		mongoose.disconnect();
		return;
	}

	let cube = cubes.shift();
	generate_short_id(function(short_id) {
		cube.shortID = short_id;
		Cube.updateOne({
			_id: cube._id
		}, cube, function(err) {
			if (err) console.log(err);
			else {
				update_short_ids(cubes);
			}
		});
	});
}

function generate_short_ids() {
	mongoose.connect(config.database);
	let db = mongoose.connection;
	db.once('open', function() {
		Cube.find({shortID:null}, function(err, cubes) {
			update_short_ids(cubes);
		});
	});
}

generate_short_ids();
