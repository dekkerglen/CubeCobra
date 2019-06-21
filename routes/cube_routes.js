const express = require('express');
let mongoose = require('mongoose');
const fs = require('fs');

const router = express.Router();

// Bring in models
let Cube = require('../models/cube');
let Deck = require('../models/deck');
let Blog = require('../models/blog');
let User = require('../models/user');
let Draft = require('../models/draft');
let CardRating = require('../models/cardrating');

// Add Submit POST Route
router.post('/add',ensureAuth, function(req,res,next)
{
  if(req.body.name.length < 5)
  {
    req.flash('danger', 'Cube name should be at least 5 characters long.');
    res.redirect('/user/account/yourcubes');
  }
  else {
    User.findById(req.user._id, function(err, user)
    {
      let cube = new Cube();
      cube.name = req.body.name;
      cube.owner = req.user._id;
      cube.cards = [];
      cube.decks = [];
      cube.articles = [];
      cube.image_uri = carddict[nameToId['doubling cube'][0]].art_crop;
      cube.image_name = carddict[nameToId['doubling cube'][0]].full_name;
      cube.image_artist = carddict[nameToId['doubling cube'][0]].artist;
      cube.description = "This is a brand new cube!";
      cube.owner_name = user.username;

      cube.save(function(err)
      {
        if(err)
        {
          console.log(err);
        }
        else
        {
          req.flash('success', 'Cube Added');
          res.redirect('/cube/overview/'+cube._id);
        }
      });
    });
  }
});

// GEt view cube Route
router.get('/view/:id', function(req, res)
{
  res.redirect('/cube/overview/'+req.params.id);
});

router.post('/blog/post/:id',ensureAuth, function(req, res)
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
        var blogpost = new Blog();
        blogpost.title=req.body.title;
        blogpost.body=req.body.body;
        blogpost.owner=user._id;
        blogpost.date=Date.now();
        blogpost.cube=cube._id;

        //console.log(draft);
        blogpost.save(function(err)
        {
          if(err)
          {
            console.log(err);
          }
          else
          {
            req.flash('success', 'Blog post successful');
            res.redirect('/cube/blog/'+cube._id);
          }
        });
      });
    }
  });
});

router.get('/overview/:id', function(req, res)
{
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findById(cube_id, function(err, cube)
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
        Blog.find({cube:cube._id}).sort('date').exec(function(err, blogs)
        {
          if(blogs.length > 0)
          {
            blogs.reverse();
          }
          if(!user)
          {
            res.render('cube_overview',
            {
              cube:cube,
              author: 'unknown',
              post:blogs[0]
            });
          }
          else
          {
            res.render('cube_overview',
            {
              cube:cube,
              owner: user.username,
              post:blogs[0]
            });
          }
        });
      });
    }
  });
});

router.get('/blog/:id', function(req, res)
{
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findById(cube_id, function(err, cube)
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
        Blog.find({cube:cube._id}).sort('date').exec(function(err, blogs)
        {
          if(blogs.length > 0)
          {
            blogs.reverse();
            if(blogs.length > 10)
            {
              var page = parseInt(split[1]);
              if(!page)
              {
                page = 0;
              }
              pages= [];
              for(i = 0; i < blogs.length/10; i++)
              {
                if(page==i)
                {
                  pages.push({
                    url:'/cube/blog/'+cube._id+';'+i,
                    content:(i+1),
                    active:true
                  });
                }
                else
                {
                  pages.push({
                    url:'/cube/blog/'+cube._id+';'+i,
                    content:(i+1)
                  });
                }
              }
              blog_page = [];
              for(i = 0; i < 10; i++)
              {
                if(blogs[i+page*10])
                {
                  blog_page.push(blogs[i+page*10]);
                }
              }
              res.render('cube_blog',
              {
                cube:cube,
                owner: user.username,
                posts:blog_page,
                pages:pages
              });
            }
            else
            {
              res.render('cube_blog',
              {
                cube:cube,
                owner: user.username,
                posts:blogs
              });
            }
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
    }
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
    if(!cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      User.findById(cube.owner, function(err, user)
      {
        Deck.find( { _id: { $in : cube.decks } }, function(err, decks)
        {
          decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length).reverse();
          if(!user || err)
          {
            res.render('cube_playtest',
            {
              cube:cube,
              author: 'unknown',
              decks:decklinks
            });
          }
          else
          {
            res.render('cube_playtest',
            {
              cube:cube,
              owner: user.username,
              decks:decklinks
            });
          }
        });
      });
    }
  });
});

function GetTypeByColor(cards) {
  var TypeByColor = {
    Creatures:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Enchantments:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Lands:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Planeswalkers:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Instants:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Sorceries:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Artifacts:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
    Total:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0}
  };
  cards.forEach(function(card_id, index)
  {
    var card = carddict[card_id];
    var type = {};
    if(card.type.toLowerCase().includes('creature'))
    {
      type = TypeByColor['Creatures'];
    }
    else if(card.type.toLowerCase().includes('enchantment'))
    {
      type = TypeByColor['Enchantments'];
    }
    else if(card.type.toLowerCase().includes('land'))
    {
      type = TypeByColor['Lands'];
    }
    else if(card.type.toLowerCase().includes('planeswalker'))
    {
      type = TypeByColor['Planeswalkers'];
    }
    else if(card.type.toLowerCase().includes('instant'))
    {
      type = TypeByColor['Instants'];
    }
    else if(card.type.toLowerCase().includes('sorcery'))
    {
      type = TypeByColor['Sorceries'];
    }
    else if(card.type.toLowerCase().includes('artifact'))
    {
      type = TypeByColor['Artifacts'];
    }

    if(card.colorcategory=='l')
    {
      if(card.colors.length == 0)
      {
        type['Colorless'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Colorless'] += 1;
        TypeByColor['Total']['Total'] += 1;
      }
      else if(card.colors.length > 1)
      {
        type['Multi'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Multi'] += 1;
        TypeByColor['Total']['Total'] += 1;
      }
      else
      {
        switch(card.colors[0])
        {
          case 'W':
          type['White'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['White'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
          case 'U':
          type['Blue'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Blue'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
          case 'B':
          type['Black'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Black'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
          case 'R':
          type['Red'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Red'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
          case 'G':
          type['Green'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Green'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
        }
      }
    }
    else
    {
      switch(card.colorcategory)
      {
        case 'w':
        type['White'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['White'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'u':
        type['Blue'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Blue'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'b':
        type['Black'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Black'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'r':
        type['Red'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Red'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'g':
        type['Green'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Green'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'm':
        type['Multi'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Multi'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
        case 'c':
        type['Colorless'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Colorless'] += 1;
        TypeByColor['Total']['Total'] += 1;
        break;
      }
    }
  });
  return TypeByColor;
}

function GetColorCounts(cards) {
  var ColorCounts = {
    White:0,
    Blue:0,
    Black:0,
    Red:0,
    Green:0,
    Azorius:0,
    Dimir:0,
    Rakdos:0,
    Gruul:0,
    Selesnya:0,
    Orzhov:0,
    Izzet:0,
    Golgari:0,
    Boros:0,
    Simic:0,
    Jund:0,
    Bant:0,
    Grixis:0,
    Naya:0,
    Esper:0,
    Jeskai:0,
    Mardu:0,
    Sultai:0,
    Temur:0,
    Abzan:0,
    NonWhite:0,
    NonBlue:0,
    NonBlack:0,
    NonRed:0,
    NonGreen:0,
    FiveColor:0
  };
  cards.forEach(function(card_id, index)
  {
    var card = carddict[card_id];
    if(card.colors.length === 2)
    {
      if(card.colors.includes('W') && card.colors.includes('U'))
      {
        ColorCounts.Azorius += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.colors.includes('B') && card.colors.includes('U'))
      {
        ColorCounts.Dimir += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.colors.includes('B') && card.colors.includes('R'))
      {
        ColorCounts.Rakdos += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('R'))
      {
        ColorCounts.Gruul += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
      }
      else if(card.colors.includes('W') && card.colors.includes('G'))
      {
        ColorCounts.Selesnya += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
      }
      else if(card.colors.includes('W') && card.colors.includes('B'))
      {
        ColorCounts.Orzhov += 1;
        ColorCounts.White += 1;
        ColorCounts.Black += 1;
      }
      else if(card.colors.includes('R') && card.colors.includes('U'))
      {
        ColorCounts.Izzet += 1;
        ColorCounts.Red += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('B'))
      {
        ColorCounts.Golgari += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
      }
      else if(card.colors.includes('W') && card.colors.includes('R'))
      {
        ColorCounts.Boros += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
       else if(card.colors.includes('G') && card.colors.includes('U'))
      {
        ColorCounts.Simic += 1
        ColorCounts.Green += 1;
        ColorCounts.Blue += 1;
      }
    }
    else if(card.colors.length == 3)
    {
      if(card.colors.includes('G') && card.colors.includes('B') && card.colors.includes('R'))
      {
        ColorCounts.Jund += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('U') && card.colors.includes('W'))
      {
        ColorCounts.Bant += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.colors.includes('U') && card.colors.includes('B') && card.colors.includes('R'))
      {
        ColorCounts.Grixis += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('W') && card.colors.includes('R'))
      {
        ColorCounts.Naya += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('U') && card.colors.includes('B') && card.colors.includes('W'))
      {
        ColorCounts.Esper += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
      }
      else if(card.colors.includes('W') && card.colors.includes('U') && card.colors.includes('R'))
      {
        ColorCounts.Jeskai += 1;
        ColorCounts.Blue += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('W') && card.colors.includes('B') && card.colors.includes('R'))
      {
        ColorCounts.Mardu += 1;
        ColorCounts.White += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('B') && card.colors.includes('U'))
      {
        ColorCounts.Sultai += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('U') && card.colors.includes('R'))
      {
        ColorCounts.Temur += 1;
        ColorCounts.Green += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(card.colors.includes('G') && card.colors.includes('B') && card.colors.includes('W'))
      {
        ColorCounts.Abzan += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
      }
    }
    else if(card.colors.length == 4)
    {
      if(!card.colors.includes('W'))
      {
        ColorCounts.NonWhite += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.colors.includes('U'))
      {
        ColorCounts.NonBlue += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.colors.includes('B'))
      {
        ColorCounts.NonBlack += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.colors.includes('R'))
      {
        ColorCounts.NonRed += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(!card.colors.includes('G'))
      {
        ColorCounts.NonGreen += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
    }
    else if(card.colors.length == 5)
    {
      ColorCounts.FiveColor += 1;
      ColorCounts.Green += 1;
      ColorCounts.Black += 1;
      ColorCounts.White += 1;
      ColorCounts.Blue += 1;
      ColorCounts.Red += 1;
    }
  });
  return ColorCounts;
}

function GetCurve(cards) {
  var curve = {
    white: [0,0,0,0,0,0,0,0,0,0],
    blue:[0,0,0,0,0,0,0,0,0,0],
    black:[0,0,0,0,0,0,0,0,0,0],
    red:[0,0,0,0,0,0,0,0,0,0],
    green:[0,0,0,0,0,0,0,0,0,0],
    colorless:[0,0,0,0,0,0,0,0,0,0],
    multi:[0,0,0,0,0,0,0,0,0,0],
    total:[0,0,0,0,0,0,0,0,0,0]
  }

  cards.forEach(function(card_id, index)
  {
    card = carddict[card_id];
    var category;
    switch(card.colorcategory)
    {
      case 'w':
      category = curve.white;
      break;
      case 'u':
      category = curve.blue;
      break;
      case 'b':
      category = curve.black;
      break;
      case 'r':
      category = curve.red;
      break;
      case 'g':
      category = curve.green;
      break;
      case 'c':
      category = curve.colorless;
      break;
      case 'm':
      category = curve.multi;
      break;
    }
    if(category)
    {
      if(card.cmc >= 9)
      {
        category[9] += 1;
        curve.total[9] += 1;
      }
      else
      {
        category[Math.floor(card.cmc)] += 1;
        curve.total[Math.floor(card.cmc)] += 1;
      }
    }
  });
  return curve;
}

router.get('/analysis/:id', function(req, res)
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

        if(err)
        {
          res.render('cube_analysis',
          {
            cube:cube,
            author: 'unknown',
            TypeByColor:GetTypeByColor(cube.cards),
            MulticoloredCounts:GetColorCounts(cube.cards),
            curve:JSON.stringify(GetCurve(cube.cards))
          });
        }
        else
        {
          res.render('cube_analysis',
          {
            cube:cube,
            owner: user.username,
            TypeByColor:GetTypeByColor(cube.cards),
            MulticoloredCounts:GetColorCounts(cube.cards),
            curve:JSON.stringify(GetCurve(cube.cards))
          });
        }
      });
    }
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

function bulkUpload(req, res, list, cube){
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
      var currentId =nameToId[item.toLowerCase().trim()];
      if(currentId && currentId[0])
      {
        cube.cards.push(currentId[0]);
        added.push(carddict[currentId[0]]);
      }
      else if(nameToId[item.toLowerCase().substring(0,item.indexOf('[')).trim()])
      {
        var found = false;
        var possibilities = nameToId[item.toLowerCase().substring(0,item.indexOf('[')).trim()];
        possibilities.forEach(function(possible, ind)
        {
          if(!found && carddict[possible].full_name.toLowerCase() == item.toLowerCase().trim())
          {
            cube.cards.push(carddict[possible]);
            added.push(carddict[possible]);
            found = true;
          }
        });
        if(!found)
        {
          missing += item +'\n';
        }
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

router.get('/download/cubecobra/:id', function(req, res)
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
        res.write(carddict[card_id].full_name + '\r\n');
      });
      res.end();
    }
  });
});

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

router.post('/startdraft/:id', function(req, res)
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
      //setup draft conditions
      cards = cube.cards;
      var cardpool = shuffle(cards.slice());
      var draft = new Draft();
      draft.numPacks = req.body.packs;
      draft.numCards = req.body.cards;
      draft.numSeats = req.body.seats;

      var botcolors = Math.ceil((draft.numSeats-1)*2/5);
      var draftbots = [];
      var colors = [];
      for(i = 0; i < botcolors; i++)
      {
        colors.push('W');
        colors.push('U');
        colors.push('B');
        colors.push('R');
        colors.push('G');
      }
      shuffle(colors);
      for(i = 0; i < draft.numSeats-1; i++)
      {
        var colorcombo= [colors.pop(), colors.pop()];
        draftbots.push(colorcombo);
      }
      draft.bots = draftbots;
      var totalCards = draft.numPacks * draft.numCards * draft.numSeats;
      if(cube.cards.length < totalCards)
      {
        req.flash('danger', 'Requested draft requires ' + totalCards + ' cards, but this cube only has ' +  cube.cards.length + ' cards.');
        res.redirect('/cube/playtest/'+cube._id);
      }
      else
      {
        draft.picks = [];
        draft.packs = [];
        draft.activepacks = [];
        draft.cube = cube._id;
        for(i = 0; i < req.body.seats; i++)
        {
          draft.picks.push([]);
          draft.packs.push([]);
          for(j = 0; j < req.body.packs - 1; j++)
          {
            draft.packs[i].push([]);
            for(k = 0; k < req.body.cards; k++)
            {
              draft.packs[i][j].push(0);
              draft.packs[i][j][k] = cardpool.pop();
            }
          }
          draft.activepacks.push([]);
          for(k = 0; k < req.body.cards; k++)
          {
            draft.activepacks[i].push(0);
            draft.activepacks[i][k] = cardpool.pop();
          }
        }

        //console.log(draft);
        draft.save(function(err)
        {
          if(err)
          {
            console.log(err);
          }
          else
          {
            res.redirect('/cube/draft/'+draft._id);
          }
        });
      }
    }
  });
});

router.get('/draft/pick/:id', function(req, res)
{
  var split = req.params.id.split(';');
  draftid = split[0];
  pick = split[1];
  Draft.findById(draftid, function(err, draft)
  {
    if(!draft)
    {
      req.flash('danger', 'Draft not found');
      res.redirect('/404/');
    }
    else
    {
      if(!draft.activepacks[0].includes(pick))
      {
        res.redirect('/cube/draft/'+draftid);
      }
      else
      {
        //add pick cardvalue
        CardRating.findById(pick, function(err, cardrating)
        {
          var rating = (draft.numCards - draft.activepacks[0].length + 1)/draft.numCards;
          if(cardrating)
          {
            cardrating.value = cardrating.value * (cardrating.picks/(cardrating.picks+1)) + rating * (1/(cardrating.picks+1));
            cardrating.picks += 1;
          }
          else
          {
            cardrating = new CardRating();
            cardrating.value = rating;
            cardrating.picks = 1;
          }
          console.log("Updated pick rating to: " + cardrating.value);
          cardrating.save(function(err)
          {
            var draftover = false;
            draft.picks[0].push(pick);
            var activecards_id = draft.activepacks[0];
            for( var i = 0; i < draft.activepacks[0].length; i++)
            {
               if ( draft.activepacks[0][i] === pick)
               {
                 draft.activepacks[0].splice(i, 1);
               }
            }

            //make bots take a pick out of active activepacks
            for(i = 1; i < draft.numSeats; i++)
            {
              var bot = draft.bots[i-1];
              var taken = false;
              //bot has 2 colors, let's try to take a card with one of those colors or colorless, otherwise take a random card
              //try to take card with exactly our two colors
              shuffle(draft.activepacks[i]);
              for(j = 0; j < draft.activepacks[i].length; j++)
              {
                //only do this if you aren't monocolor
                if(!taken && bot[0] != bot[1])
                {
                  if(carddict[draft.activepacks[i][j]].colors.length == 2)
                  {
                    if(carddict[draft.activepacks[i][j]].colors.includes(bot[0]) && carddict[draft.activepacks[i][j]].colors.includes(bot[1]))
                    {
                      pick = draft.activepacks[i].splice(j,1);
                      draft.picks[i].push(pick[0]);
                      taken = true;
                    }
                  }
                }
              }
              //try to take card with one color
              for(j = 0; j < draft.activepacks[i].length; j++)
              {
                if(!taken)
                {
                  if(carddict[draft.activepacks[i][j]].colors.length == 1)
                  {
                    if(carddict[draft.activepacks[i][j]].colors.includes(bot[0]) || carddict[draft.activepacks[i][j]].colors.includes(bot[1]))
                    {
                      pick = draft.activepacks[i].splice(j,1);
                      draft.picks[i].push(pick[0]);
                      taken = true;
                    }
                  }
                }
              }
              //try to take card that contains one of our colors, or is colorless
              for(j = 0; j < draft.activepacks[i].length; j++)
              {
                if(!taken)
                {
                  if(carddict[draft.activepacks[i][j]].colors.includes(bot[0]) || carddict[draft.activepacks[i][j]].colors.includes(bot[1]))
                  {
                    pick = draft.activepacks[i].splice(j,1);
                    draft.picks[i].push(pick[0]);
                    taken = true;
                  }
                }
              }
              //take a random card
              if(!taken)
              {
                pick = draft.activepacks[i].splice( Math.floor(Math.random() * draft.activepacks[i].length),1);
                draft.picks[i].push(pick[0]);
              }
            }

            if(draft.activepacks[0].length <= 0)
            {
              if(draft.packs[0].length > 0)
              {
                //open new packs
                for(i = 0; i < draft.numSeats; i++)
                {
                  draft.activepacks[i] = draft.packs[i].pop();
                }
              }
              else
              {
                //draft is over
                draftover = true;
              }
            }
            else
            {
              //rotate active packs
              draft.activepacks.unshift(draft.activepacks.pop());
            }
            if(draftover)
            {
              Draft.updateOne({_id:draft._id}, draft, function(err)
              {
                if(err)
                {
                  console.log(err);
                }
                else
                {
                  //create deck, save it, redirect to it
                  var deck = new Deck();
                  deck.cards = draft.picks;
                  if(req.user)
                  {
                    deck.owner = req.user._id;
                  }
                  deck.cube = draft.cube;
                  deck.date = Date.now();
                  deck.bots = draft.bots;
                  Cube.findById(draft.cube,function(err, cube)
                  {
                    User.findById(deck.owner, function(err, user)
                    {
                      var owner = "Anonymous";
                      if(user)
                      {
                        owner = user.username;
                      }
                      deck.name = owner + "'s draft of " + cube.name + " on "+ deck.date.toLocaleString("en-US");
                      cube.decks.push(deck._id);
                      cube.save(function(err)
                      {
                        deck.save(function(err)
                        {
                          if(err)
                          {
                            console.log(err);
                          }
                          else
                          {
                            return res.redirect('/cube/deck/'+deck._id);
                          }
                        });
                      });
                    });
                  });
                }
              });
            }
            else
            {
              Draft.updateOne({_id:draft._id}, draft, function(err)
              {
                if(err)
                {
                  console.log(err);
                }
                else
                {
                  res.redirect('/cube/draft/'+draftid);
                }
              });
            }
          });
        });
      }
    }
  });
});

router.get('/draft/:id', function(req, res)
{
  Draft.findById(req.params.id, function(err, draft)
  {
    if(!draft)
    {
      req.flash('danger', 'Draft not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      var picks_id = draft.picks[0];
      var activecards_id = draft.activepacks[0];
      var picks = [];
      var activecards = [];
      var pickNumber = draft.numCards + 1 - draft.activepacks[0].length;
      var packNumber = draft.numPacks - draft.packs[0].length;
      var title = 'Pack ' + packNumber + ', Pick ' + pickNumber;
      var packsleft= (draft.numPacks - packNumber);
      var subtitle =  packsleft + ' unopened packs left.';
      if(packsleft == 1)
      {
        subtitle =  packsleft + ' unopened pack left.';
      }
      picks_id.forEach(function(id, index)
      {
        picks.push(carddict[id]);
      });
      activecards_id.forEach(function(id, index)
      {
        activecards.push(carddict[id]);
      });
      Cube.findById(draft.cube, function(err, cube)
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
            if(!user || err)
            {
              res.render('cube_draft',
              {
                title:title,
                subtitle:subtitle,
                draftid:draft._id,
                cube:cube,
                picks:picks,
                owner: 'Unkown',
                activecards:activecards
              });
            }
            else
            {
              res.render('cube_draft',
              {
                title:title,
                subtitle:subtitle,
                draftid:draft._id,
                cube:cube,
                picks:picks,
                owner: user.username,
                activecards:activecards
              });
            }
          });
        }
      });
    }
  });
});

// Edit Submit POST Route
router.post('/editoverview/:id',ensureAuth, function(req,res,next)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    if(err)
    {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/overview/'+req.params.id);
    }
    else if(!cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/overview/'+req.params.id);
    }
    else
    {
      var image = imagedict[req.body.imagename];
      var description = req.body.description;
      var name = req.body.name;

      if(!image)
      {
        req.flash('danger', 'Invalid image selection. Please choose from the list.');
        res.redirect('/cube/overview/'+req.params.id);
      }
      else if(name.length < 5)
      {
        req.flash('danger', 'Cube name should be at least 5 characters long.');
        res.redirect('/cube/overview/'+req.params.id);
      }
      else
      {
        cube.image_uri = image.uri;
        cube.image_artist = image.artist;
        cube.image_name = req.body.imagename;
        cube.description = description;
        cube.name = name;
        cube.save(function(err)
        {
          if(err)
          {
            req.flash('danger', 'Server Error');
            res.redirect('/cube/overview/'+req.params.id);
          }
          else {

              req.flash('success', 'Cube updated successfully.');
              res.redirect('/cube/overview/'+req.params.id);
          }
        });
      }
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
      var changelog = "";
      edits.forEach(function(edit, index)
      {
        if(edit.charAt(0) == '+')
        {
          //add id
          cube.cards.push(edit.substring(1));
          changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
          changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '">' + carddict[edit.substring(1)].name + '</a>';
        }
        else if(edit.charAt(0) == '-')
        {
          //remove id
          if(cube.cards.includes(edit.substring(1)))
          {
            var index = cube.cards.indexOf(edit.substring(1));
            if (index !== -1) {
                cube.cards.splice(index, 1);
            }

            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-danger">–</span> ';
            changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '">' +carddict[edit.substring(1)].name + '</a>';
          }
          else
          {
            fail_remove.push(edit.substring(1));
          }
        }
        else if(edit.charAt(0) == '/')
        {
          var tmp_split = edit.substring(1).split('>');
          cube.cards.push(tmp_split[1]);
          if(cube.cards.includes(tmp_split[0]))
          {
            var index = cube.cards.indexOf(tmp_split[0]);
            if (index !== -1) {
                cube.cards.splice(index, 1);
            }
            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-primary">→</span> ';
            changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[0]].image_normal + '">' + carddict[tmp_split[0]].name + '</a> > ';
            changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '">' + carddict[tmp_split[1]].name + '</a>';
          }
          else
          {
            fail_remove.push(tmp_split[0]);
            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
            changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '">' + carddict[tmp_split[1]].name + '</a>';
          }
        }
        changelog += '<br>';
      });


      var blogpost = new Blog();
      blogpost.title='Cube Updated - Automatic Post'
      blogpost.html=changelog;
      blogpost.owner=cube.owner;
      blogpost.date=Date.now();
      blogpost.cube=cube._id;

      //console.log(draft);
      blogpost.save(function(err)
      {
        if(err)
        {
          console.log(err);
        }
        else
        {
          if(fail_remove.length > 0)
          {
            var errors = ""
            fail_remove.forEach(function(fail, index)
            {
              if(index != 0)
              {
                errors += ", ";
              }
              errors += carddict[fail].name;
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

router.get('/api/imagedict', function(req, res)
{
  res.status(200).send({
    success:'true',
    dict:imagedict
  });
});

router.get('/api/fullnames', function(req, res)
{
  res.status(200).send({
    success:'true',
    cardnames:full_names
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

router.get('/deck/:id', function(req, res)
{
  Deck.findById(req.params.id, function(err, deck)
  {
    if(!deck)
    {
      req.flash('danger', 'Deck not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      Cube.findById(deck.cube, function(err, cube)
      {
        var owner_name = "Unknown";
        var drafter_name = "Anonymous";
        User.findById(deck.owner, function(err, drafter)
        {
          if(drafter)
          {
            drafter_name = drafter.username;
          }
          User.findById(cube.owner, function(err, owner)
          {
            if(owner)
            {
              owner_name = owner.username;
            }
            var player_deck = [];
            var bot_decks = []
            deck.cards[0].forEach(function(card, index)
            {
              player_deck.push(carddict[card]);
            });
            for(i = 1; i < deck.cards.length; i++)
            {
              var bot_deck = [];
              deck.cards[i].forEach(function(card, index)
              {
                if(!carddict[card])
                {
                  console.log("Could not find seat " + (bot_decks.length+1) + ", pick " + (bot_deck.length+1));
                }
                else {
                  bot_deck.push(carddict[card]);
                }
              });
              bot_decks.push(bot_deck);
            }
            var bot_names = [];
            for(i=0; i < deck.bots.length; i++)
            {
              bot_names.push("Seat " + (i+2) + ": " + deck.bots[i][0] + ", " + deck.bots[i][1]);
            }
            return res.render('cube_deck',
            {
              cube:cube,
              owner: owner_name,
              drafter:drafter_name,
              cards:player_deck,
              bot_decks:bot_decks,
              bots:bot_names
            });
          });
        });
      });
    }
  });
});

router.get('/api/getcard/:name', function(req, res)
{
  req.params.name = req.params.name.replace('-slash-','//').toLowerCase().trim();
  console.log(req.params.name);
  var card = carddict[nameToId[req.params.name][0]];
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

router.delete('/remove/:id',ensureAuth, function(req, res)
{
  console.log(req);
  if(!req.user._id)
  {
    res.status(500).send();
  }

  let query = {_id:req.params.id};

  Cube.findById(req.params.id, function(err, cube)
  {
    if(err || (cube.owner != req.user._id))
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
//utility function
function arrayRemove(arr, value) {
   return arr.filter(function(ele){
       return ele != value;
   });
}

function shuffle(array)
{
	var currentIndex = array.length;
	var temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;

};
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
var imagedict = {};
var cardnames = [];
var full_names = [];
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
fs.readFile('private/full_names.json', 'utf8', function(err, contents) {
    full_names = JSON.parse(contents);
    console.log("full_names loaded");
});
fs.readFile('private/imagedict.json', 'utf8', function(err, contents) {
    imagedict = JSON.parse(contents);
    console.log("imagedict loaded");
});
fs.watchFile('private/imagedict.json', (curr, prev) => {
  console.log('File Changed: imagedict');
  fs.readFile('private/imagedict.json', 'utf8', function(err, contents) {
      imagedict = JSON.parse(contents);
      console.log("imagedict updated");
  });
});
fs.watchFile('private/cardtree.json', (curr, prev) => {
  console.log('File Changed: cardtree');
  fs.readFile('private/cardtree.json', 'utf8', function(err, contents) {
      cardtree = JSON.parse(contents);
      console.log("cardtree updated");
  });
});
fs.watchFile('private/names.json', (curr, prev) => {
  console.log('File Changed: names');
  fs.readFile('private/names.json', 'utf8', function(err, contents) {
      cardnames = JSON.parse(contents);
      console.log("names updated");
  });
});
fs.watchFile('private/carddict.json', (curr, prev) => {
  console.log('File Changed: carddict');
  fs.readFile('private/carddict.json', 'utf8', function(err, contents) {
      carddict = JSON.parse(contents);
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
fs.watchFile('private/full_names.json', (curr, prev) => {
  console.log('File Changed: full_names');
  fs.readFile('private/full_names.json', 'utf8', function(err, contents) {
      full_names = JSON.parse(contents);
      console.log("full_names updated");
  });
});

module.exports = router;
