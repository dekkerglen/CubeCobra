const express = require('express');
let mongoose = require('mongoose');
const fs = require('fs');

const router = express.Router();

// Bring in models
let Cube = require('../models/cube');
let User = require('../models/user');

// Add Submit POST Route
router.post('/add',ensureAuth, function(req,res,next)
{
  req.checkBody('name', 'Name is required').notEmpty();

  //handle error checks
  let errors = req.validationErrors();

  if(errors)
  {
    res.render('/user/account/yourcubes', {
      errors:errors
    });
  }
  else {
    let cube = new Cube();
    cube.name = req.body.name;
    cube.owner = req.user._id;
    cube.cards = [];
    cube.decks = [];
    cube.articles = [];

    cube.save(function(err)
    {
      if(err)
      {
        console.log(err);
      }
      else
      {
        req.flash('success', 'Cube Added');
        res.redirect('/cube/list/'+cube._id);
      }
    });
  }
});

// GEt view cube Route
router.get('/view/:id',function(req, res)
{
  res.redirect('/cube/list/'+req.params.id);
});

router.get('/blog/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, user)
    {
      if(err)
      {
        res.render('cube_blog',
        {
          cube:cube,
          author: 'unknown'
        });
      }
      else
      {
        res.render('cube_blog',
        {
          cube:cube,
          owner: user.username
        });
      }
    });
  });
});

router.get('/list/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    if(!cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      User.findById(cube.owner, function(err, user)
      {
        var sorted_cards =
        {
          white: [],
          blue: [],
          red: [],
          green: [],
          black: [],
          multi: [],
          colorless: [],
          lands: []
        };
        cube.cards.forEach(function(card_id, index)
        {
          var card = carddict[card_id];
          if(card.type.toLowerCase().includes('land'))
          {
            sorted_cards.lands.push(card);
          }
          else if(card.colors.length == 0)
          {
            sorted_cards.colorless.push(card);
          }
          else if(card.colors.length > 1)
          {
            sorted_cards.multi.push(card);
          }
          else {
            switch(card.colors[0])
            {
              case "W":
                sorted_cards.white.push(card);
                break;
              case "U":
                sorted_cards.blue.push(card);
                break;
              case "B":
                sorted_cards.black.push(card);
                break;
              case "R":
                sorted_cards.red.push(card);
                break;
              case "G":
                sorted_cards.green.push(card);
                break;
            }
          }
        });
        sort_fn = function(a,b){
          if(a.cmc == b.cmc)
          {
            return  ( ( a.name == b.name ) ? 0 : ( ( a.name > b.name ) ? 1 : -1 ) );
          }
          else {
            return a.cmc-b.cmc;
          }
        };
        sorted_cards.white.sort(sort_fn);
        sorted_cards.blue.sort(sort_fn);
        sorted_cards.black.sort(sort_fn);
        sorted_cards.red.sort(sort_fn);
        sorted_cards.green.sort(sort_fn);
        sorted_cards.colorless.sort(sort_fn);
        sorted_cards.multi.sort(sort_fn);
        if(err)
        {
          res.render('cube_list',
          {
            cube:cube,
            author: 'unknown',
            cards:sorted_cards
          });
        }
        else
        {
          res.render('cube_list',
          {
            cube:cube,
            owner: user.username,
            cards:sorted_cards
          });
        }
      });
    }
  });
});

router.get('/playtest/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, user)
    {
      if(err)
      {
        res.render('cube_playtest',
        {
          cube:cube,
          author: 'unknown'
        });
      }
      else
      {
        res.render('cube_playtest',
        {
          cube:cube,
          owner: user.username
        });
      }
    });
  });
});

router.get('/analysis/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, user)
    {
      if(err)
      {
        res.render('cube_analysis',
        {
          cube:cube,
          author: 'unknown'
        });
      }
      else
      {
        res.render('cube_analysis',
        {
          cube:cube,
          owner: user.username
        });
      }
    });
  });
});

router.post('/bulkupload/:id',ensureAuth, function(req,res,next)
{
  Cube.findById(req.params.id, function(err,cube)
  {
    if(err)
    {
      console.log(err);
    }
    else
    {
      if(cube.owner != req.user._id)
      {
        req.flash('danger','Not Authorized');
        res.redirect('/cube/list/'+req.params.id);
      }
      else
      {
        bulkUpload(req,res,req.body.body,cube);
      }
    }
  });
});

router.post('/bulkuploadfile/:id',ensureAuth, function(req,res,next)
{
  if(!req.files)
  {
    req.flash('danger','Please attach a file');
    res.redirect('/cube/list/'+req.params.id);
  }
  else
  {
    items = req.files.document.data.toString('utf8'); // the uploaded file object

    Cube.findById(req.params.id, function(err,cube)
    {
      if(cube.owner != req.user._id)
      {
        req.flash('danger','Not Authorized');
        res.redirect('/cube/list/'+req.params.id);
      }
      else
      {
        bulkUpload(req,res,items,cube);
      }
    });
  }
});

function bulkUpload(req, res, list, cube)
{
  cards = list.match(/[^\r\n]+/g);
  if(!cards)
  {
    req.flash('danger', 'No Cards Detected');
    res.redirect('/cube/list/'+req.params.id);
  }
  else
  {
    var missing = "";
    var added = [];
    cards.forEach(function(item, index)
    {
      var currentId =nameToId[item.toLowerCase()];
      if(currentId)
      {
        cube.cards.push(currentId);
        added.push(carddict[currentId]);
      }
      else
      {
        missing += item +'\n';
      }
    });
    if(missing.length > 0)
    {
      res.render('bulk_upload',
      {
        missing:missing,
        added:JSON.stringify(added),
        cube:cube
      });
    }
    else
    {
      Cube.updateOne({_id:cube._id}, cube, function(err)
      {
        if(err)
        {
          console.log(err);
        }
        else
        {
          req.flash('success', 'All cards successfully added.');
          res.redirect('/cube/list/'+req.params.id);
        }
      });
    }
  }
}

router.get('/download/plaintext/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    if(!cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name + '.txt');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card_id, index)
      {
        res.write(carddict[card_id].name + '\r\n');
      });
      res.end();
    }
  });
});

// Edit Submit POST Route
router.post('/edit/:id',ensureAuth, function(req,res,next)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    if(err)
    {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/list/'+req.params.id);
    }
    else if(!cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/list/'+req.params.id);
    }
    else
    {
      var edits = req.body.body.split(';');
      var fail_remove = [];
      var adds = [];
      var removes = [];
      edits.forEach(function(edit, index)
      {
        if(edit.charAt(0) == '+')
        {
          //add id
          cube.cards.push(edit.substring(1));
        }
        else
        {
          //remove id
          if(cube.cards.includes(edit.substring(1)))
          {
            var index = cube.cards.indexOf(edit.substring(1));
            if (index !== -1) {
                cube.cards.splice(index, 1);
            }
          }
          else
          {
            fail_remove.push(edit.substring(1));
          }
        }
      });

      if(fail_remove.length > 0)
      {
        Card.find({'_id': { $in:fail_remove}}, function(err, fails)
        {
          var errors = ""
          fails.forEach(function(fail, index)
          {
            if(index != 0)
            {
              errors += ", ";
            }
            errors += fail.name;
          });
          Cube.updateOne({_id:cube._id}, cube, function(err)
          {
            if(err)
            {
              console.log(err);
            }
            else
            {
              req.flash('warning', 'Cube Updated With Errors, could not remove the following cards: ' + errors);
              res.redirect('/cube/list/'+req.params.id);
            }
          });
        });
      }
      else
      {
        Cube.updateOne({_id:cube._id}, cube, function(err)
        {
          if(err)
          {
            console.log(err);
          }
          else
          {
            req.flash('success', 'Cube Updated');
            res.redirect('/cube/list/'+req.params.id);
          }
        });
      }
    }
  });
});

//API routes
router.get('/api/cardnames', function(req, res)
{
  res.status(200).send({
    success:'true',
    cardnames:cardtree
  });
});

router.get('/api/cubecardnames/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    cardnames = [];
    cube.cards.forEach(function (item, index)
    {
      binaryInsert(carddict[item].name,cardnames);
    });
    var result = turnToTree(cardnames);
    res.status(200).send({
      success:'true',
      cardnames:result
    });
  });
});

router.get('/api/getcardfromcube/:id', function(req, res)
{
  var split = req.params.id.split(';');
  var cube = split[0];
  var cardname = split[1].replace('-slash-','//').toLowerCase();
  Cube.findById(cube, function(err, cube)
  {
    var found = false;
    cube.cards.forEach(function(card, index)
    {
      if(!found && carddict[card].name_lower == cardname)
      {
        res.status(200).send({
          success:'true',
          card:carddict[card]
        });
        found = true;
      }
    });
    if(!found)
    {
      res.status(200).send({
        success:'true'
      });
    }
  });
});

router.get('/api/getcard/:name', function(req, res)
{
  req.params.name = req.params.name.replace('-slash-','//').toLowerCase();
  var card = carddict[nameToId[req.params.name]];
  if(!card)
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

/*
router.delete('/remove/:id',ensureAuth, function(req, res)
{
  if(!req.user._id)
  {
    res.status(500).send();
  }

  let query = {_id:req.params.id};

  Cube.findById(req.params.id, function(err, cube)
  {
    if(err || (cube.author != req.user._id))
    {
      res.status(500).send();
    }
    else
    {
      Cube.deleteOne(query, function(err)
      {
        if(err)
        {
          console.log(err);
        }
        req.flash('success', 'Cube Removed');
        res.send('Success');
      });
    }
  });
});
*/

// Access Control
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
//utility function
function arrayRemove(arr, value) {

   return arr.filter(function(ele){
       return ele != value;
   });

}
//cube autocomplete functions
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
function turnToTree(arr)
{
  var res = {};
  arr.forEach(function (item, index)
  {
    //add_word(cardnames, card);
    add_word(res, item);
  });
  return res;
}
function binaryInsert(value, array, startVal, endVal)
{
	var length = array.length;
	var start = typeof(startVal) != 'undefined' ? startVal : 0;
  var end = typeof(endVal) != 'undefined' ? endVal : length - 1;//!! endVal could be 0 don't use || syntax
	var m = start + Math.floor((end - start)/2);

	if(length == 0){
		array.push(value);
		return;
	}

	if(value > array[end]){
		array.splice(end + 1, 0, value);
		return;
	}

	if(value < array[start]){//!!
		array.splice(start, 0, value);
		return;
	}

	if(start >= end){
		return;
	}

	if(value < array[m]){
		binaryInsert(value, array, start, m - 1);
		return;
	}

	if(value > array[m]){
		binaryInsert(value, array, m + 1, end);
		return;
	}
}

//read files
var cardtree = {};
var cardnames = [];
var carddict = {};
var nameToId = {};
fs.readFile('private/cardtree.json', 'utf8', function(err, contents) {
    cardtree = JSON.parse(contents);
    console.log("cardtree loaded");
});
fs.readFile('private/names.json', 'utf8', function(err, contents) {
    cardnames = JSON.parse(contents);
    console.log("names loaded");
});
fs.readFile('private/carddict.json', 'utf8', function(err, contents) {
    carddict = JSON.parse(contents);
    console.log("carddict loaded");
});
fs.readFile('private/nameToId.json', 'utf8', function(err, contents) {
    nameToId = JSON.parse(contents);
    console.log("nameToId loaded");
});
fs.watchFile('private/cardtree.json', (curr, prev) => {
  console.log('File Changed: cardtree');
  fs.readFile('private/cardtree.json', 'utf8', function(err, contents) {
      nameToId = JSON.parse(contents);
      console.log("cardtree updated");
  });
});
fs.watchFile('private/names.json', (curr, prev) => {
  console.log('File Changed: names');
  fs.readFile('private/names.json', 'utf8', function(err, contents) {
      nameToId = JSON.parse(contents);
      console.log("names updated");
  });
});
fs.watchFile('private/carddict.json', (curr, prev) => {
  console.log('File Changed: carddict');
  fs.readFile('private/carddict.json', 'utf8', function(err, contents) {
      nameToId = JSON.parse(contents);
      console.log("carddict updated");
  });
});
fs.watchFile('private/nameToId.json', (curr, prev) => {
  console.log('File Changed: nameToId');
  fs.readFile('private/nameToId.json', 'utf8', function(err, contents) {
      nameToId = JSON.parse(contents);
      console.log("nameToId updated");
  });
});

module.exports = router;
