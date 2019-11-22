const mongoose = require('mongoose');
const Cube = require('../models/cube');
const { generate_short_id } = require('../serverjs/cubefn.js');

(async () => {
  mongoose.connect(config.database).then(async (db) => {
    let cubes = await Cube.find({ shortID: null }, ['_id', 'shortID']);
    for (let i = 0; i < cubes.length; i++) {
      let cube = cubes[i];
      let short_id = await generate_short_id();
      console.log(
        'Generated short ID ' + short_id + ' for cube ' + cube._id + '. ' + (cubes.length - i - 1) + ' cubes left.',
      );
      cube.shortID = short_id;
      await Cube.updateOne({ _id: cube._id }, cube);
    }
    mongoose.disconnect();
  });
})();

/*
(async () => {
	mongoose.connect(config.database).then( async (db) => {
		let cubes = await Cube.find({}, [ '_id', 'shortID' ] );
		for (let i = 0; i < cubes.length; i++) {
			let cube = cubes[i];
			cube.shortID = cube.shortID.toLowerCase();
			console.log(( cubes.length - i - 1 ) + ' cubes left.' );
			await Cube.updateOne({_id: cube._id }, cube);
		}
		mongoose.disconnect();
	});
})();
*/
