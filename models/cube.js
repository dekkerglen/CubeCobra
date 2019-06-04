let mongoose = require('mongoose');

// Cube schema
let cubeSchema = mongoose.Schema(
  {
    title:
    {
      type: String,
      required: true
    },
    author:
    {
      type: String,
      required: true
    },
    body:
    {
      type:String,
      required:true
    }
  }
);

let Cube = module.exports = mongoose.model('Cube',cubeSchema)
