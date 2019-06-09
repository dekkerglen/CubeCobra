const express = require('express');
let mongoose = require('mongoose');
const router = express.Router();

// Bring in models
let Card = require('../models/card');
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
    Card.find({'_id': { $in:cube.cards}}, function(err, cards)
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
          colorless: []
        };
        cards.forEach(function(card, index)
        {
          if(card.colors.length == 0)
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
    });
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
        cards = req.body.body.match(/[^\r\n]+/g);
        if(!cards)
        {
          req.flash('danger', 'No Cards Detected');
          res.redirect('/cube/list/'+req.params.id);
        }
        else
        {
          queries = [];
          cards.forEach(function(item, index)
          {
            queries.push(Card.findOne({name_lower:item.toLowerCase()}));
          });
          Promise.all(queries).then( (results) =>
          {
            results.forEach(function(item, index)
            {
              if(item)
              {
                cube.cards.push(item._id);
              }
            });
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
          }).catch(function(err)
          {
            console.log(err);
          });
        }
        /*
        Card.find({'name': { $in:cards}}, function(err, cards)
        {
          cards.forEach(function (item, index)
          {
            cube.cards.push(item._id);
          });
          Cube.updateOne({_id:cube._id}, cube, function(err)
          {
            if(err)
            {
              console.log(err);
            }
            else
            {
            }
          });
        });
        */
      }
    }
  });
});
/*
// Get edit cube Route
router.get('/edit/:id',ensureAuth,function(req, res,next)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    if(cube.author != req.user._id)
    {
      req.flash('danger','Not Authorized');
      return res.redirect('/');
    }
    User.findById(cube.author, function(err, user)
    {
      res.render('edit_cube',
      {
        cube:cube,
        author: user.username
      });
    });
  });
});

// Edit Submit POST Route
router.post('/edit/:id',ensureAuth, function(req,res,next)
{
  let cube = {};
  cube.title = req.body.title;
  cube.author = req.user._id;
  cube.body = req.body.body;

  let query = {_id:req.params.id};

  Cube.updateOne(query, cube, function(err)
  {
    if(err)
    {
      console.log(err);
    }
    else
    {
      req.flash('success', 'Cube Updated');
      res.redirect('/cube/view/'+req.params.id);
    }
  });
});

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
function arrayRemove(arr, value) {

   return arr.filter(function(ele){
       return ele != value;
   });

}

module.exports = router;
