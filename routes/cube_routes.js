const express = require('express');
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
        res.redirect('/cube/view/'+cube._id);
      }
    });
  }
});

// GEt view cube Route
router.get('/view/:id',function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, user)
    {
      if(err)
      {
        res.render('view_cube',
        {
          cube:cube,
          author: 'unknown'
        });
      }
      else
      {
        res.render('view_cube',
        {
          cube:cube,
          owner: user.username
        });
      }
    });
  });
});

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
        author: user.name
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

module.exports = router;
