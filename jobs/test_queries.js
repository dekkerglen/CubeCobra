const fetch = require('node-fetch');
const now = require('performance-now');
const User = require('../models/user');

const queries = [
  ["User.findOne({username_lower:'dekkaru'})", async () => User.findOne({ username_lower: 'dekkaru' })],
  ["User.findOne({username_lower:'brl451'})", async () => User.findOne({ username_lower: 'brl451' })],
];

const size = 10;

(async () => {
  for (const query of queries) {
    console.log(query[0]);
    let sum = 0;

    for (let i = 0; i < size; i++) {
      const start = now();
      await query[1];

      const end = now();
      sum += end - start;
    }

    console.log(`   ${(sum / size).toFixed(3)}`);
  }
  process.exit();
})();
