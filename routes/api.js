const express = require('express');
let mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Bring in models
let Card = require('../models/card');
let Cube = require('../models/cube');
let User = require('../models/user');


function add_word(obj, word)
{
  if(word.length <= 0)
  {
    return;
  }
  else if(word.length == 1)
  {
    if(!obj[word.charAt(0)])
    {
      obj[word.charAt(0)] = {'$':{}};
    }
    else
    {
      obj[word.charAt(0)]['$']={};
    }
  }
  else
  {
    character = word.charAt(0);
    word = word.substr(1, word.length)
    if(!obj[character])
    {
      obj[character] = {};
    }
    add_word(obj[character], word)
  }
}
function turnToTree_createFullName(arr)
{
  var res = {};
  arr.forEach(function (item, index)
  {
    //add_word(cardnames, card);
    add_word(res, item.name + ' [' + item.set + '-'+ item.collector_number + ']');
  });
  return res;
}
function turnToTree(arr)
{
  var res = {};
  arr.forEach(function (item, index)
  {
    //add_word(cardnames, card);
    add_word(res, item.name);
  });
  return res;
}


//var contents = fs.readFileSync('private/names.json');
var contents = fs.readFileSync('private/cardtree.json');
var cardtree = JSON.parse(contents);

//var contents = fs.readFileSync(dir);
// Define to JSON type
//var cards = JSON.parse(contents);
//saveAllCards(cards);

router.get('/cardnames', function(req, res)
{
  res.status(200).send({
    success:'true',
    cardnames:cardtree
  });
});

router.get('/cubecardnames/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    cards_ids = [];
    cube.cards.forEach(function (item, index) {
      cards_ids.push(item);
    });
    Card.find({'_id': { $in:cards_ids}}, function(err, cards)
    {
      var result = turnToTree(cards);
      res.status(200).send({
        success:'true',
        cardnames:result
      });
    });
  });
});


router.get('/getcardfromcube/:id', function(req, res)
{
  var split = req.params.id.split(';');
  var cube = split[0];
  var cardname = split[1];
  Cube.findById(cube, function(err, cube)
  {
    Card.find({'_id': { $in:cube.cards}}, function(err, cards)
    {
      cards.forEach(function(card, index)
      {
        if(card.name_lower == cardname.toLowerCase())
        {
          res.status(200).send({
            success:'true',
            card:card
          });
          return;
        }
      });
    });
  });
});

router.get('/getcard/:name', function(req, res)
{
  req.params.name = req.params.name.replace('-slash-','//');
  Card.findOne({'name_lower':req.params.name.toLowerCase()}, function(err, card) {
    if(err || !card)
    {
      res.status(200).send({
        success:'true'
      });
    }
    else
    {
      res.status(200).send({
        success:'true',
        card:card
      });
    }
  });
});

function ensureAuth(req, res, next)
{
  if(req.isAuthenticated())
  {
    return next();
  }
  else
  {
    req.flash('danger','Please login to view this content');
    res.redirect('/user/login');
  }
}


module.exports = router;
