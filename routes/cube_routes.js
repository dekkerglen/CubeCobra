const express = require('express');
let mongoose = require('mongoose');
const request = require('request');
const fs = require('fs');
const rp = require('request-promise');
const cheerio = require('cheerio');
var sanitizeHtml = require('sanitize-html');

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
  else
  {
    User.findById(req.user._id, function(err, user)
    {
      Cube.find({owner:user._id}, function(err, cubes)
      {
        if(cubes.length < 24)
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
          cube.date_updated = Date.now();
          cube.updated_string = cube.date_updated.toLocaleString("en-US");
          cube = setCubeType(cube);
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
        }
        else
        {
          req.flash('danger', 'Cannot create a cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.');
          res.redirect('/user/account/yourcubes');
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
  req.body.html = sanitize(req.body.html);
  if(req.body.title.length < 5 || req.body.title.length > 100)
  {
    req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
    res.redirect('/cube/blog/'+req.params.id);
  }
  else if(req.body.html.length <= 10)
  {
    req.flash('danger', 'Blog body length must be greater than 10 characters.');
    res.redirect('/cube/blog/'+req.params.id);
  }
  else
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
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString("en-US");
        cube = setCubeType(cube);
        cube.save(function(err)
        {
          User.findById(cube.owner, function(err, user)
          {
            if(req.body.id && req.body.id.length > 0)
            {
              Blog.findById(req.body.id, function(err, blog)
              {
                if(err || !blog)
                {
                  req.flash('success', 'Unable to update this blog post.');
                  res.redirect('/cube/blog/'+cube._id);
                }
                else
                {
                  blog.html=req.body.html;
                  blog.title=req.body.title;

                  blog.save(function(err)
                  {
                    if(err)
                    {
                      console.log(err);
                    }
                    else
                    {
                      req.flash('success', 'Blog update successful');
                      res.redirect('/cube/blog/'+cube._id);
                    }
                  });
                }
              });
            }
            else
            {
              var blogpost = new Blog();
              blogpost.html=req.body.html;
              blogpost.title=req.body.title;
              blogpost.owner=user._id;
              blogpost.date=Date.now();
              blogpost.cube=cube._id;
              blogpost.dev='false';
              blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

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
            }
          });
        });
      }
    });
  }
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
          blogs.forEach(function(item, index){
            if(!item.date_formatted)
            {
              item.date_formatted = item.date.toLocaleString("en-US");
            }
            if(item.html)
            {
              item.html = addAutocard(item.html);
            }
          });
          if(blogs.length > 0)
          {
            blogs.reverse();
          }
          cube.raw_desc = cube.body;
          if(cube.descriptionhtml)
          {
            cube.raw_desc = cube.descriptionhtml;
            cube.descriptionhtml = addAutocard(cube.descriptionhtml);
          }
          if(!user)
          {
            res.render('cube_overview',
            {
              cube:cube,
              num_cards:cube.cards.length,
              author: 'unknown',
              post:blogs[0],
              loginCallback:'/cube/overview/'+req.params.id
            });
          }
          else
          {
            res.render('cube_overview',
            {
              cube:cube,
              num_cards:cube.cards.length,
              owner: user.username,
              post:blogs[0],
              loginCallback:'/cube/overview/'+req.params.id,
              editorvalue:cube.raw_desc
            });
          }
        });
      });
    }
  });
});

router.get('/blogsrc/:id', function(req, res)
{
  Blog.findById(req.params.id, function(err, blog)
  {
    if(err || !blog)
    {
      res.status(400).send({
        success:'false'
      });
    }
    else
    {
      res.status(200).send({
        success:'true',
        src:blog.html,
        title:blog.title,
        body:blog.body
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
          if(!user)
          {
            user = {username:'unknown'};
          }
          blogs.forEach(function(item, index){
            if(!item.date_formatted)
            {
              item.date_formatted = item.date.toLocaleString("en-US");
            }
            if(item.html)
            {
              item.html = addAutocard(item.html);
            }
          });
          var pages = [];
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
                pages:pages,
                loginCallback:'/cube/blog/'+req.params.id
              });
            }
            else
            {
              res.render('cube_blog',
              {
                cube:cube,
                owner: user.username,
                posts:blogs,
                loginCallback:'/cube/blog/'+req.params.id
              });
            }
          }
          else
          {
            res.render('cube_blog',
            {
              cube:cube,
              owner: user.username,
              loginCallback:'/cube/blog/'+req.params.id
            });
          }
        });
      });
    }
  });
});

router.get('/visualspoiler/:id', function(req, res)
{
  LoadListView(req, res, 'cube_visualspoiler','/cube/visualspoiler/'+req.params.id);
});

router.get('/list/:id', function(req, res)
{
  LoadListView(req, res, 'cube_list','/cube/list/'+req.params.id);
});

function LoadListView(req, res, template, callback)
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
      cube.cards.forEach(function(card, index)
      {
        card.details = carddict[card.cardID];
      });

      if(req.user)
      {
        User.findById(req.user._id, function(err, currentuser)
        {
          if(!currentuser.edit_token || currentuser.edit_token.length <= 0)
          {
            currentuser.edit_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          }
          currentuser.save(function(err)
          {
            User.findById(cube.owner, function(err, owner)
            {
              if(!owner)
              {
                res.render(template,
                {
                  cube:cube,
                  cube_raw:JSON.stringify(cube.cards),
                  author: 'unknown',
                  loginCallback:callback,
                  edittoken:currentuser.edit_token
                });
              }
              else
              {
                res.render(template,
                {
                  cube:cube,
                  cube_raw:JSON.stringify(cube.cards),
                  owner: owner.username,
                  loginCallback:callback,
                  edittoken:currentuser.edit_token
                });
              }
            });
          });
        });
      }
      else
      {
        User.findById(cube.owner, function(err, owner)
        {
          if(!owner)
          {
            res.render(template,
            {
              cube:cube,
              cube_raw:JSON.stringify(cube.cards),
              author: 'unknown',
              loginCallback:callback
            });
          }
          else
          {
            res.render(template,
            {
              cube:cube,
              cube_raw:JSON.stringify(cube.cards),
              owner: owner.username,
              loginCallback:callback
            });
          }
        });
      }
    }
  });
}

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
              decks:decklinks,
              loginCallback:'/cube/playtest/'+req.params.id
            });
          }
          else
          {
            res.render('cube_playtest',
            {
              cube:cube,
              owner: user.username,
              decks:decklinks,
              loginCallback:'/cube/playtest/'+req.params.id
            });
          }
        });
      });
    }
  });
});


function GetColorCategoryServerSide(type, colors)
{
  if(type.toLowerCase().includes('land'))
  {
    return 'l';
  }
  else if(colors.length == 0)
  {
    return 'c';
  }
  else if(colors.length >  1)
  {
    return 'm';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
      case "W":
        return 'w';
        break;
      case "U":
        return 'u';
        break;
      case "B":
        return 'b';
        break;
      case "R":
        return 'r';
        break;
      case "G":
        return 'g';
        break;
      case "C":
        return 'c';
        break;
    }
  }
}

function GetColorCategory(type, colors)
{
  if(type.toLowerCase().includes('land'))
  {
    return 'Lands';
  }
  else if(colors.length == 0)
  {
    return 'Colorless';
  }
  else if(colors.length >  1)
  {
    return 'Multicolored';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
      case "W":
        return 'White';
        break;
      case "U":
        return 'Blue';
        break;
      case "B":
        return 'Black';
        break;
      case "R":
        return 'Red';
        break;
      case "G":
        return 'Green';
        break;
      case "C":
        return 'Colorless';
        break;
    }
  }
}

function GetColorIdentity(colors)
{
  if(colors.length == 0)
  {
    return 'Colorless';
  }
  else if(colors.length >  1)
  {
    return 'Multicolored';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
      case "W":
        return 'White';
        break;
      case "U":
        return 'Blue';
        break;
      case "B":
        return 'Black';
        break;
      case "R":
        return 'Red';
        break;
      case "G":
        return 'Green';
        break;
      case "C":
        return 'Colorless';
        break;
    }
  }
}

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
  cards.forEach(function(card, index)
  {
    card.details = carddict[card.cardID];
  });
  cards.forEach(function(card, index)
  {
    var type = {};
    if(card.details.type.toLowerCase().includes('creature'))
    {
      type = TypeByColor['Creatures'];
    }
    else if(card.details.type.toLowerCase().includes('enchantment'))
    {
      type = TypeByColor['Enchantments'];
    }
    else if(card.details.type.toLowerCase().includes('land'))
    {
      type = TypeByColor['Lands'];
    }
    else if(card.details.type.toLowerCase().includes('planeswalker'))
    {
      type = TypeByColor['Planeswalkers'];
    }
    else if(card.details.type.toLowerCase().includes('instant'))
    {
      type = TypeByColor['Instants'];
    }
    else if(card.details.type.toLowerCase().includes('sorcery'))
    {
      type = TypeByColor['Sorceries'];
    }
    else if(card.details.type.toLowerCase().includes('artifact'))
    {
      type = TypeByColor['Artifacts'];
    }

    var colorCategory = GetColorCategoryServerSide(card.details.type, card.colors);
    if(colorCategory=='l')
    {
      if(card.details.colors.length == 0)
      {
        type['Colorless'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Colorless'] += 1;
        TypeByColor['Total']['Total'] += 1;
      }
      else if(card.details.colors.length > 1)
      {
        type['Multi'] += 1;
        type['Total'] += 1;
        TypeByColor['Total']['Multi'] += 1;
        TypeByColor['Total']['Total'] += 1;
      }
      else
      {
        switch(card.details.colors[0])
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
          case 'C':
          type['Colorless'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Colorless'] += 1;
          TypeByColor['Total']['Total'] += 1;
          break;
        }
      }
    }
    else
    {
      switch(colorCategory)
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
        default:
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
  cards.forEach(function(card, index)
  {
    card.details = carddict[card.cardID];
  });
  cards.forEach(function(card, index)
  {
    if(card.details.colors.length === 2)
    {
      if(card.details.colors.includes('W') && card.details.colors.includes('U'))
      {
        ColorCounts.Azorius += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.details.colors.includes('B') && card.details.colors.includes('U'))
      {
        ColorCounts.Dimir += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.details.colors.includes('B') && card.details.colors.includes('R'))
      {
        ColorCounts.Rakdos += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('R'))
      {
        ColorCounts.Gruul += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
      }
      else if(card.details.colors.includes('W') && card.details.colors.includes('G'))
      {
        ColorCounts.Selesnya += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
      }
      else if(card.details.colors.includes('W') && card.details.colors.includes('B'))
      {
        ColorCounts.Orzhov += 1;
        ColorCounts.White += 1;
        ColorCounts.Black += 1;
      }
      else if(card.details.colors.includes('R') && card.details.colors.includes('U'))
      {
        ColorCounts.Izzet += 1;
        ColorCounts.Red += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('B'))
      {
        ColorCounts.Golgari += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
      }
      else if(card.details.colors.includes('W') && card.details.colors.includes('R'))
      {
        ColorCounts.Boros += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
       else if(card.details.colors.includes('G') && card.details.colors.includes('U'))
      {
        ColorCounts.Simic += 1
        ColorCounts.Green += 1;
        ColorCounts.Blue += 1;
      }
    }
    else if(card.colors.length == 3)
    {
      if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('R'))
      {
        ColorCounts.Jund += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('W'))
      {
        ColorCounts.Bant += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('R'))
      {
        ColorCounts.Grixis += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('W') && card.details.colors.includes('R'))
      {
        ColorCounts.Naya += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('W'))
      {
        ColorCounts.Esper += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
      }
      else if(card.details.colors.includes('W') && card.details.colors.includes('U') && card.details.colors.includes('R'))
      {
        ColorCounts.Jeskai += 1;
        ColorCounts.Blue += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('W') && card.details.colors.includes('B') && card.details.colors.includes('R'))
      {
        ColorCounts.Mardu += 1;
        ColorCounts.White += 1;
        ColorCounts.Black += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('U'))
      {
        ColorCounts.Sultai += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('R'))
      {
        ColorCounts.Temur += 1;
        ColorCounts.Green += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('W'))
      {
        ColorCounts.Abzan += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
      }
    }
    else if(card.colors.length == 4)
    {
      if(!card.details.colors.includes('W'))
      {
        ColorCounts.NonWhite += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.details.colors.includes('U'))
      {
        ColorCounts.NonBlue += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.details.colors.includes('B'))
      {
        ColorCounts.NonBlack += 1;
        ColorCounts.Green += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
      else if(!card.details.colors.includes('R'))
      {
        ColorCounts.NonRed += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
      }
      else if(!card.details.colors.includes('G'))
      {
        ColorCounts.NonGreen += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
    }
    else if(card.details.colors.length == 5)
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

  cards.forEach(function(card, index)
  {
    card.details = carddict[card.cardID];
  });
  cards.forEach(function(card, index)
  {
    var category;
    switch(GetColorCategoryServerSide(card.details.type, card.colors))
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
        if(!user)
        {
          user = {username:'unknown'};
        }
        if(err)
        {
          res.render('cube_analysis',
          {
            cube:cube,
            owner: user.username,
            TypeByColor:GetTypeByColor(cube.cards),
            MulticoloredCounts:GetColorCounts(cube.cards),
            curve:JSON.stringify(GetCurve(cube.cards)),
            loginCallback:'/cube/analysis/'+req.params.id
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
            curve:JSON.stringify(GetCurve(cube.cards)),
            loginCallback:'/cube/analysis/'+req.params.id
          });
        }
      });
    }
  });
});

router.post('/importcubetutor/:id',ensureAuth, function(req,res,next) {
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
        const options = {
          uri: 'http://www.cubetutor.com/viewcube/'+req.body.cubeid,
          transform: function (body) {
            return cheerio.load(body);
          },
          headers: {
            //this tricks cubetutor into not redirecting us to the unsupported browser page
              'User-Agent': 'Mozilla/5.0'
          },
        };
        rp(options).then(function (data)
        {
          var cards = [];
          var unknown = [];
          data('.cardPreview').each(function(i, elem) {
            var str = elem.attribs['data-image'].substring(37,elem.attribs['data-image'].length-4);
            if(!str.includes('/'))
            {
              cards.push({
                set:'unknown',
                name:decodeURIComponent(elem.children[0].data).replace('_flip','')
              })
            }
            else
            {
              var split = str.split('/');
              cards.push({
                set:split[0],
                name:decodeURIComponent(elem.children[0].data).replace('_flip','')
              })
            }
          });
          var added = [];
          var missing = "";
          var changelog = "";
          cards.forEach(function(card, index)
          {
            var currentId =nameToId[card.name.toLowerCase().trim()];
            if(currentId && currentId[0])
            {
              var found = false;
              currentId.forEach(function(possible, index)
              {
                if(!found && carddict[possible].set.toUpperCase() == card.set)
                {
                  found = true;
                  added.push(carddict[possible]);
                  var details = carddict[possible];
                  cube.cards.push(
                    {
                      tags:['New'],
                      status:"Not Owned",
                      colors:details.color_identity,
                      cmc:details.cmc,
                      cardID:possible
                    }
                  );
                  changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                  if(carddict[possible].image_flip)
                  {
                    changelog += '<a class="dynamic-autocard" card="'+ carddict[possible].image_normal + '" card_flip="'+ carddict[possible].image_flip + '">' + carddict[possible].name + '</a></br>';
                  }
                  else
                  {
                    changelog += '<a class="dynamic-autocard" card="'+ carddict[possible].image_normal + '">' + carddict[possible].name + '</a></br>';
                  }
                }
              });
              if(!found)
              {
                added.push(carddict[currentId[0]]);
                var details = carddict[currentId[0]];
                cube.cards.push(
                  {
                    tags:['New'],
                    status:"Not Owned",
                    colors:details.color_identity,
                    cmc:details.cmc,
                    cardID:currentId[0]
                  }
                );
                changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                if(carddict[currentId[0]].image_flip)
                {
                  changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '" card_flip="'+ carddict[currentId[0]].image_flip + '">' + carddict[currentId[0]].name + '</a></br>';
                }
                else
                {
                  changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '">' + carddict[currentId[0]].name + '</a></br>';
                }
              }
            }
            else
            {
              missing += card.name +'\n';
            }
          });

          var blogpost = new Blog();
          blogpost.title='Cubetutor Import - Automatic Post'
          blogpost.html=changelog;
          blogpost.owner=cube.owner;
          blogpost.date=Date.now();
          blogpost.cube=cube._id;
          blogpost.dev='false';
          blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

          blogpost.save(function(err)
          {
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
              cube = setCubeType(cube);
              Cube.updateOne({_id:cube._id}, cube, function(err)
              {
                if(err)
                {
                  req.flash('danger', 'Error adding cards. Please try again.');
                  res.redirect('/cube/list/'+req.params.id);
                }
                else
                {
                  req.flash('success', 'All cards successfully added.');
                  res.redirect('/cube/list/'+req.params.id);
                }
              });
            }
          });
        })
        .catch(function (err) {
          console.log(err);
          req.flash('danger','Error: Unable to import this cube.');
          res.redirect('/cube/list/'+req.params.id);
        });
      }
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

function bulkuploadCSV(req, res, cards, cube) {
  var added = [];
  var missing = "";
  var changelog = "";
  cards.forEach(function(card_raw, index)
  {
    var split = CSVtoArray(card_raw);
    var card = {
      name:split[0],
      cmc:split[1],
      colors:split[3].split(''),
      set:split[4].toUpperCase(),
      status:split[5],
      tags:split[6].split(',')
    };
    var currentId =nameToId[card.name.toLowerCase().trim()];
    if(currentId && currentId[0])
    {
      var found = false;
      currentId.forEach(function(possible, index)
      {
        if(!found && carddict[possible].set.toUpperCase() == card.set)
        {
          found = true;
          added.push(carddict[possible]);
          var details = carddict[possible];
          cube.cards.push(
            {
              tags:card.tags,
              status:card.status,
              colors:card.colors,
              cmc:card.cmc,
              cardID:possible
            }
          );
          changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
          if(carddict[possible].image_flip)
          {
            changelog += '<a class="dynamic-autocard" card="'+ carddict[possible].image_normal + '" card_flip="'+ carddict[possible].image_flip + '">' + carddict[possible].name + '</a></br>';
          }
          else
          {
            changelog += '<a class="dynamic-autocard" card="'+ carddict[possible].image_normal + '">' + carddict[possible].name + '</a></br>';
          }
        }
      });
      if(!found)
      {
        added.push(carddict[currentId[0]]);
        var details = carddict[currentId[0]];
        cube.cards.push(
          {
            tags:card.tags,
            status:card.status,
            colors:card.colors,
            cmc:card.cmc,
            cardID:currentId[0]
          }
        );
        changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
        if(carddict[currentId[0]].image_flip)
        {
          changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '" card_flip="'+ carddict[currentId[0]].image_flip + '">' + carddict[currentId[0]].name + '</a></br>';
        }
        else
        {
          changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '">' + carddict[currentId[0]].name + '</a></br>';
        }
      }
    }
    else
    {
      missing += card.name +'\n';
    }
  });

  var blogpost = new Blog();
  blogpost.title='Cube Bulk Import - Automatic Post'
  blogpost.html=changelog;
  blogpost.owner=cube.owner;
  blogpost.date=Date.now();
  blogpost.cube=cube._id;
  blogpost.dev='false';
  blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

  //console.log(draft);
  blogpost.save(function(err)
  {
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
      cube = setCubeType(cube);
      Cube.updateOne({_id:cube._id}, cube, function(err)
      {
        if(err)
        {
          req.flash('danger', 'Error adding cards. Please try again.');
          res.redirect('/cube/list/'+req.params.id);
        }
        else
        {
          req.flash('success', 'All cards successfully added.');
          res.redirect('/cube/list/'+req.params.id);
        }
      });
    }
    });
}

function bulkUpload(req, res, list, cube) {
  cards = list.match(/[^\r\n]+/g);
  if(cards)
  {
    if(cards[0].trim() == 'Name,CMC,Type,Color,Set,Status,Tags')
    {
      cards.splice(0,1);
      bulkuploadCSV(req, res, cards, cube);
    }
    else
    {
      cube.date_updated = Date.now();
      cube.updated_string = cube.date_updated.toLocaleString("en-US");
      if(!cards)
      {
        req.flash('danger', 'No Cards Detected');
        res.redirect('/cube/list/'+req.params.id);
      }
      else
      {
        var missing = "";
        var added = [];
        var changelog = "";
        for(i = 0; i < cards.length; i++)
        {
          item=cards[i].toLowerCase().trim();
          if(/([0-9]+x )(.*)/.test(item))
          {
            var count = parseInt(item.substring(0,item.indexOf('x')));
            for(j = 0; j < count; j++)
            {
              cards.push(item.substring(item.indexOf('x')+1));
            }
          }
          else
          {
            if(/(.*)( \((.*)\))/.test(item))
            {
              //has set info
              if(nameToId[item.toLowerCase().substring(0,item.indexOf('(')).trim()])
              {
                var name = item.toLowerCase().substring(0,item.indexOf('(')).trim();
                var set = item.toLowerCase().substring(item.indexOf('(')+1,item.indexOf(')'))
                //if we've found a match, and it DOES need to be parsed with cubecobra syntax
                var found = false;
                var possibilities = nameToId[name];
                possibilities.forEach(function(possible, ind)
                {
                  if(!found && carddict[possible].set.toLowerCase() == set)
                  {
                    var details = carddict[possible];
                    cube.cards.push(
                      {
                        tags:['New'],
                        status:"Not Owned",
                        colors:details.color_identity,
                        cmc:details.cmc,
                        cardID:carddict[possible]
                      }
                    );
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
                //we didn't find a match for this item
                missing += item +'\n';
              }
            }
            else
            {
              //does not have set info
              var currentId =nameToId[item.toLowerCase().trim()];
              if(currentId && currentId[0])
              {
                //if we've found a match, and it doesn't need to be parsed with cubecobra syntax
                var details = carddict[currentId[0]];
                cube.cards.push(
                  {
                    tags:['New'],
                    status:"Not Owned",
                    colors:details.color_identity,
                    cmc:details.cmc,
                    cardID:currentId[0]
                  }
                );
                added.push(carddict[currentId[0]]);
                changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                if(carddict[currentId[0]].image_flip)
                {
                  changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '" card_flip="'+ carddict[currentId[0]].image_flip + '">' + carddict[currentId[0]].name + '</a></br>';
                }
                else
                {
                  changelog += '<a class="dynamic-autocard" card="'+ carddict[currentId[0]].image_normal + '">' + carddict[currentId[0]].name + '</a></br>';
                }
              }
              else
              {
                //we didn't find a match for this item
                missing += item +'\n';
              }
            }
          }
        }

        var blogpost = new Blog();
        blogpost.title='Cube Bulk Import - Automatic Post'
        blogpost.html=changelog;
        blogpost.owner=cube.owner;
        blogpost.date=Date.now();
        blogpost.cube=cube._id;
        blogpost.dev='false';
        blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

        //console.log(draft);
        blogpost.save(function(err)
        {
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
            cube = setCubeType(cube);
            Cube.updateOne({_id:cube._id}, cube, function(err)
            {
              if(err)
              {
                req.flash('danger', 'Error adding cards. Please try again.');
                res.redirect('/cube/list/'+req.params.id);
              }
              else
              {
                req.flash('success', 'All cards successfully added.');
                res.redirect('/cube/list/'+req.params.id);
              }
            });
          }
        });
      }
    }
  }
  else
  {
    req.flash('danger', 'Error adding cards. Invalid format.');
    res.redirect('/cube/list/'+req.params.id);
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
      cube.cards.forEach(function(card, index)
      {
        res.write(carddict[card.cardID].full_name + '\r\n');
      });
      res.end();
    }
  });
});

router.get('/download/csv/:id', function(req, res)
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
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name + '.csv');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      res.write('Name,CMC,Type,Color,Set,Status,Tags\r\n');
      cube.cards.forEach(function(card, index)
      {
        res.write('"' + carddict[card.cardID].name + '"' + ',');
        res.write(card.cmc+ ',');
        res.write('"' + carddict[card.cardID].type.replace('—','-') + '"' + ',');
        if(card.colors.length == 0)
        {
          res.write('C,');
        }
        else if(carddict[card.cardID].type.toLowerCase().includes('land'))
        {
          res.write('L,');
        }
        else
        {
          card.colors.forEach(function(color, c_index)
          {
            res.write(color);
          });
          res.write(',');
        }
        res.write('"' + carddict[card.cardID].set + '"' + ',');
        res.write(card.status+ ',"');
        card.tags.forEach(function(tag, t_index)
        {
          if(t_index != 0)
          {
          res.write(', ');
          }
          res.write(tag);
        });
        res.write('"\r\n');
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
      cube.cards.forEach(function(card, index)
      {
        res.write(carddict[card.cardID].name + '\r\n');
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
      var found = false;
      draft.activepacks[0].forEach(function(card, index)
      {
        if(card.cardID == pick)
        {
          found = true;
        }
      });
      if(!found)
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

          cardrating.save(function(err)
          {
            var draftover = false;
            draft.picks[0].push(pick);
            var activecards_id = draft.activepacks[0];
            for( var i = 0; i < draft.activepacks[0].length; i++)
            {
               if ( draft.activepacks[0][i].cardID === pick)
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
                  if(draft.activepacks[i][j].colors.length == 2)
                  {
                    if(draft.activepacks[i][j].colors.includes(bot[0]) && draft.activepacks[i][j].colors.includes(bot[1]))
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
                  if(draft.activepacks[i][j].colors.length == 1)
                  {
                    if(draft.activepacks[i][j].colors.includes(bot[0]) || draft.activepacks[i][j].colors.includes(bot[1]))
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
                  if(draft.activepacks[i][j].colors.includes(bot[0]) || draft.activepacks[i][j].colors.includes(bot[1]))
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
                    if(!cube.decks)
                    {
                      cube.decks = [];
                    }
                    cube.decks.push(deck._id);
                    if(!cube.numDecks)
                    {
                      cube.numDecks = 0;
                    }
                    cube.numDecks += 1;
                    cube.save(function(err)
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
                  res.redirect('/cube/draft/'+draft._id);
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
        picks.push(carddict[id[0]]);
      });
      activecards_id.forEach(function(id, index)
      {
        activecards.push(carddict[id.cardID]);
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
                picks:picks.reverse(),
                owner: 'Unkown',
                activecards:activecards,
                loginCallback:'/cube/draft/'+req.params.id
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
                picks:picks.reverse(),
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
  req.body.html = sanitize(req.body.html);
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
      var name = req.body.name;

      if(name.length < 5)
      {
        req.flash('danger', 'Cube name should be at least 5 characters long.');
        res.redirect('/cube/overview/'+req.params.id);
      }
      else
      {
        if(image)
        {
          cube.image_uri = image.uri;
          cube.image_artist = image.artist;
          cube.image_name = req.body.imagename;
        }
        cube.descriptionhtml = req.body.html;
        cube.name = name;
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString("en-US");

        cube = setCubeType(cube);
        cube.save(function(err)
        {
          if(err)
          {
            req.flash('danger', 'Server Error');
            res.redirect('/cube/overview/'+req.params.id);
          }
          else
          {
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
  req.body.blog = sanitize(req.body.blog);
  Cube.findById(req.params.id, function(err, cube)
  {
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString("en-US");
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
          var details = carddict[edit.substring(1)];
          cube.cards.push(
            {
              tags:['New'],
              status:"Not Owned",
              colors:details.colors,
              cmc:details.cmc,
              cardID:edit.substring(1)
            }
          );
          changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
          if(carddict[edit.substring(1)].image_flip)
          {
            changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '" card_flip="'+ carddict[edit.substring(1)].image_flip + '">' + carddict[edit.substring(1)].name + '</a></br>';
          }
          else
          {
            changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '">' + carddict[edit.substring(1)].name + '</a>';
          }
        }
        else if(edit.charAt(0) == '-')
        {
          //remove id
          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index)
          {
            if(rm_index == -1)
            {
              if(card_to_remove.cardID == edit.substring(1))
              {
                rm_index = remove_index;
              }
            }
          });
          if(rm_index != -1)
          {
            cube.cards.splice(rm_index, 1);

            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-danger">–</span> ';
            if(carddict[edit.substring(1)].image_flip)
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '" card_flip="'+ carddict[edit.substring(1)].image_flip + '">' +carddict[edit.substring(1)].name + '</a>';
            }
            else
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[edit.substring(1)].image_normal + '">' +carddict[edit.substring(1)].name + '</a>';
            }
          }
          else
          {
            fail_remove.push(edit.substring(1));
          }
        }
        else if(edit.charAt(0) == '/')
        {
          var tmp_split = edit.substring(1).split('>');
          var details = carddict[tmp_split[1]];
          cube.cards.push(
            {
              tags:['New'],
              status:"Not Owned",
              colors:details.colors,
              cmc:details.cmc,
              cardID:tmp_split[1]
            }
          );

          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index)
          {
            if(rm_index == -1)
            {
              if(card_to_remove.cardID == tmp_split[0])
              {
                rm_index = remove_index;
              }
            }
          });
          if(rm_index != -1)
          {
            cube.cards.splice(rm_index, 1);

            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-primary">→</span> ';
            if(carddict[tmp_split[0]].image_flip)
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[0]].image_normal + '" card_flip="'+ carddict[tmp_split[0]].image_flip + '">' + carddict[tmp_split[0]].name + '</a> > ';
            }
            else
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[0]].image_normal + '">' + carddict[tmp_split[0]].name + '</a> > ';
            }
            if(carddict[tmp_split[1]].image_flip)
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '" card_flip="'+ carddict[tmp_split[1]].image_flip + '">' + carddict[tmp_split[1]].name + '</a>';
            }
            else
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '">' + carddict[tmp_split[1]].name + '</a>';
            }
          }
          else
          {
            fail_remove.push(tmp_split[0]);
            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
            if(carddict[tmp_split[1]].image_flip)
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '" card_flip="'+ carddict[tmp_split[1]].image_flip + '">' + carddict[tmp_split[1]].name + '</a>';
            }
            else
            {
              changelog += '<a class="dynamic-autocard" card="'+ carddict[tmp_split[1]].image_normal + '">' + carddict[tmp_split[1]].name + '</a>';
            }
          }
        }
        changelog += '<br>';
      });

      var blogpost = new Blog();
      blogpost.title=req.body.title;
      if(req.body.blog.length > 0)
      {
        blogpost.html=req.body.blog;
      }
      blogpost.changelist=changelog;
      blogpost.owner=cube.owner;
      blogpost.date=Date.now();
      blogpost.cube=cube._id;
      blogpost.dev='false';
      blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

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
            cube = setCubeType(cube);
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
            cube = setCubeType(cube);
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
      binaryInsert(carddict[item.cardID].name,cardnames);
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
  var cardname = split[1].replace('-slash-','//').replace('-q-','?').toLowerCase();
  Cube.findById(cube, function(err, cube)
  {
    var found = false;
    cube.cards.forEach(function(card, index)
    {
      if(!found && carddict[card.cardID].name_lower == cardname)
      {
        card.details = carddict[card.cardID];
        res.status(200).send({
          success:'true',
          card:card.details
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

router.get('/decks/:id', function(req, res)
{
  var split = req.params.id.split(';');
  var cubeid = split[0];
  Cube.findById(cubeid, function(err, cube)
  {
    if(err || !cube)
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      Deck.find({cube:cubeid}).sort('date').exec(function(err, decks)
      {
        User.findById(cube.owner, function(err, owner)
        {
          var owner_name = 'unknown';
          if(owner)
          {
            owner_name = owner.username;
          }
          var pages = [];
          var pagesize = 30;
          if(decks.length > 0)
          {
            decks.reverse();
            if(decks.length > pagesize)
            {
              var page = parseInt(split[1]);
              if(!page)
              {
                page = 0;
              }
              for(i = 0; i < decks.length/pagesize; i++)
              {
                if(page==i)
                {
                  pages.push({
                    url:'/cube/decks/'+cubeid+';'+i,
                    content:(i+1),
                    active:true
                  });
                }
                else
                {
                  pages.push({
                    url:'/cube/decks/'+cubeid+';'+i,
                    content:(i+1),
                  });
                }
              }
              deck_page = [];
              for(i = 0; i < pagesize; i++)
              {
                if(decks[i+page*pagesize])
                {
                  deck_page.push(decks[i+page*pagesize]);
                }
              }
              res.render('cube_decks',
              {
                cube:cube,
                owner:owner_name,
                decks:deck_page,
                pages:pages,
                loginCallback:'/user/decks/'+cubeid
              });
            }
            else
            {
              res.render('cube_decks',
              {
                cube:cube,
                owner:owner_name,
                decks:decks,
                loginCallback:'/user/decks/'+cubeid
              });
            }
          }
          else
          {
            res.render('cube_decks',
            {
              cube:cube,
              owner:owner_name,
              loginCallback:'/user/decks/'+cubeid,
              decks:[]
            });
          }
        });
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
        if(!cube)
        {
          req.flash('danger', 'Cube not found');
          res.redirect('/404/'+req.params.id);
        }
        else
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
                if(!carddict[card[0]] || !carddict[card[0].cardID])
                {
                  console.log("Could not find seat " + (bot_decks.length+1) + ", pick " + (bot_deck.length+1));
                }
                else {
                  bot_deck.push(carddict[card[0].cardID]);
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
              bots:bot_names,
              loginCallback:'/cube/deck/'+req.params.id
            });
          });
        });
        }
      });
    }
  });
});

router.get('/api/getcard/:name', function(req, res)
{
  req.params.name = req.params.name.replace('-slash-','//').replace('-q-','?').toLowerCase().trim();
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

router.get('/api/getimage/:name', function(req, res)
{
  req.params.name = req.params.name.replace('-slash-','//').replace('-q-','?').toLowerCase().trim();
  var img = imagedict[req.params.name];
  if(!img)
  {
    res.status(200).send({
      success:'true'
    });
  }
  else
  {
    res.status(200).send({
      success:'true',
      img:img
    });
  }
});

router.get('/api/getcardfromid/:id', function(req, res)
{
  var card = carddict[req.params.id];
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

router.get('/api/getversions/:id', function(req, res)
{
  cards = [];
  nameToId[carddict[req.params.id].name.toLowerCase()].forEach(function(id, index)
  {
    cards.push(carddict[id]);
  });
  res.status(200).send({
    success:'true',
    cards:cards
  });
});

router.post('/api/updatecard/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, owner)
    {
      if(req.body.token != owner.edit_token)
      {
        res.status(401).send({
          success:'false',
          message:'Unauthorized'
        });
      }
      else
      {
        var found = false;
        cube.cards.forEach(function(card, index)
        {
          if(!found && cardsAreEquivalent(card, req.body.src))
          {
            found = true;
            cube.cards[index] = req.body.updated;
          }
        });
        if(!found)
        {
          res.status(400).send({
            success:'false',
            message:'Card not found'
          });
        }
        else
        {
          cube = setCubeType(cube);
          cube.save(function(err)
          {
            if(err)
            {
              res.status(500).send({
                success:'false',
                message:'Error saving cube'
              });
            }
            else
            {
              res.status(200).send({
                success:'true'
              });
            }
          });
        }
      }
    });
  });
});

router.post('/api/updatecards/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, owner)
    {
      if(req.body.token != owner.edit_token)
      {
        res.status(401).send({
          success:'false',
          message:'Unauthorized'
        });
      }
      else
      {
        var found = false;
        cube.cards.forEach(function(card, index)
        {
          card.details = carddict[card.cardID];
          if(req.body.filters == null || filterCard(card,req.body.filters))
          {
            if(cardIsLabel(card,req.body.categories[0],req.body.sorts[0]) && cardIsLabel(card,req.body.categories[1],req.body.sorts[1]))
            {
              if(req.body.updated.status)
              {
                cube.cards[index].status = req.body.updated.status;
              }
              if(req.body.updated.tags)
              {
                if(req.body.updated.addTags)
                {
                  req.body.updated.tags.forEach(function(newtag, tag_ind)
                  {
                    if(!cube.cards[index].tags.includes(newtag))
                    {
                      cube.cards[index].tags.push(newtag);
                    }
                  });
                }
                else
                {
                  //remove the tags
                  req.body.updated.tags.forEach(function(tag, tag_in)
                  {
                    var temp = cube.cards[index].tags.indexOf(tag);
                    if (temp > -1) {
                       cube.cards[index].tags.splice(temp, 1);
                    }
                  });
                }
              }
            }
          }
        });
        cube.save(function(err)
        {
          if(err)
          {
            res.status(500).send({
              success:'false',
              message:'Error saving cube'
            });
          }
          else
          {
            res.status(200).send({
              success:'true'
            });
          }
        });
      }
    });
  });
});

router.delete('/remove/:id',ensureAuth, function(req, res)
{
  if(!req.user._id)
  {
    req.flash('danger', 'Not Authorized');
    res.redirect('/'+req.params.id);
  }

  let query = {_id:req.params.id};

  Cube.findById(req.params.id, function(err, cube)
  {
    if(err || (cube.owner != req.user._id))
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
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

router.delete('/blog/remove/:id',ensureAuth, function(req, res)
{
  if(!req.user._id)
  {
    req.flash('danger', 'Not Authorized');
    res.redirect('/'+req.params.id);
  }

  let query = {_id:req.params.id};

  Blog.findById(req.params.id, function(err, blog)
  {
    if(err || (blog.owner != req.user._id))
    {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/'+req.params.id);
    }
    else
    {
      Blog.deleteOne(query, function(err)
      {
        if(err)
        {
          console.log(err);
        }
        req.flash('success', 'Post Removed');
        res.send('Success');
      });
    }
  });
});

router.post('/api/savesorts/:id', function(req, res)
{
  Cube.findById(req.params.id, function(err, cube)
  {
    User.findById(cube.owner, function(err, owner)
    {
      if(req.body.token != owner.edit_token)
      {
        res.status(401).send({
          success:'false',
          message:'Unauthorized'
        });
      }
      else
      {
        var found = false;
        cube.default_sorts = req.body.sorts;
        cube.save(function(err)
        {
          if(err)
          {
            res.status(500).send({
              success:'false',
              message:'Error saving cube'
            });
          }
          else
          {
            res.status(200).send({
              success:'true'
            });
          }
        });
      }
    });
  });
});

// Access Control
function ensureAuth(req, res, next) {
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

function shuffle(array) {
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
function add_word(obj, word) {
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

function turnToTree(arr) {
  var res = {};
  arr.forEach(function (item, index)
  {
    //add_word(cardnames, card);
    add_word(res, item);
  });
  return res;
}

function binaryInsert(value, array, startVal, endVal) {
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

function cardsAreEquivalent(card, details) {
  if(card.cardID != details.cardID)
  {
    return false;
  }
  if(card.status != details.status)
  {
    return false;
  }
  if(card.cmc != details.cmc)
  {
    return false;
  }
  if(!arraysEqual(card.tags,details.tags))
  {
    return false;
  }
  if(!arraysEqual(card.colors,details.colors))
  {
    return false;
  }

  return true;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

//taken from https://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-comma-in-data
function CSVtoArray(text) {
  let ret = [''], i = 0, p = '', s = true;
  for (let l in text)
  {
    l = text[l];
    if ('"' === l)
    {
      s = !s;
      if ('"' === p)
      {
        ret[i] += '"';
        l = '-';
      }
      else if ('' === p)
      {
        l = '-';
      }
    }
    else if (s && ',' === l)
    {
      l = ret[++i] = '';
    }
    else
    {
      ret[i] += l;
    }
    p = l;
  }
  return ret;
}


function cardIsLabel(card, label, sort)
{
  if(sort == 'Color Category')
  {
    return GetColorCategory(card.details.type, card.colors) == label;
  }
  else if(sort == 'Color Identity')
  {
    return GetColorIdentity(card.colors) == label;
  }
  else if(sort == 'Color')
  {
    switch(label)
    {
      case 'White':
        return card.details.colors.includes('W');
      case 'Blue':
        return card.details.colors.includes('U');
      case 'Black':
        return card.details.colors.includes('B');
      case 'Green':
        return card.details.colors.includes('G');
      case 'Red':
        return card.details.colors.includes('R');
      case 'Colorless':
        return card.details.colors.length == 0;
    }
  }
  else if(sort == '4+ Color')
  {
    if(card.colors.length < 4)
    {
      return false;
    }
    switch(label)
    {
      case 'Non-White':
        return !card.colors.includes('W');
      case 'Non-Blue':
        return !card.colors.includes('U');
      case 'Non-Black':
        return !card.colors.includes('B');
      case 'Non-Green':
        return !card.colors.includes('G');
      case 'Non-Red':
        return !card.colors.includes('R');
      case 'Five Color':
        return card.colors.length == 5;
    }
  }
  else if (sort == 'CMC')
  {
    if(card.cmc >= 8)
    {
      return label == '8+';
    }
    return card.cmc == label;
  }
  else if(sort == 'Supertype' || sort =='Type')
  {
    if(card.details.type.includes('Contraption'))
    {
      return label == 'Contraption';
    }
    else if(label == 'Plane')
    {
      return card.details.type.includes(label) && !card.details.type.includes('Planeswalker');
    }
    return card.details.type.includes(label);
  }
  else if(sort == 'Tags')
  {
    if(label == "")
    {
      return false;
    }
    return card.tags.includes(label);
  }
  else if (sort == 'Status')
  {
    return card.status == label;
  }
  else if (sort == 'Guilds')
  {
    if(card.colors.length != 2)
    {
      return false;
    }
    switch(label)
    {
      case 'Azorius':
        return card.colors.includes('W') && card.colors.includes('U');
      case 'Dimir':
        return card.colors.includes('B') && card.colors.includes('U');
      case 'Rakdos':
        return card.colors.includes('B') && card.colors.includes('R');
      case 'Gruul':
        return card.colors.includes('G') && card.colors.includes('R');
      case 'Selesnya':
        return card.colors.includes('W') && card.colors.includes('G');
      case 'Orzhov':
        return card.colors.includes('W') && card.colors.includes('B');
      case 'Izzet':
        return card.colors.includes('R') && card.colors.includes('U');
      case 'Golgari':
        return card.colors.includes('G') && card.colors.includes('B');
      case 'Boros':
        return card.colors.includes('W') && card.colors.includes('R');
      case 'Simic':
        return card.colors.includes('G') && card.colors.includes('U');
    }
  }
  else if (sort == 'Shards / Wedges')
  {
    if(card.colors.length != 3)
    {
      return false;
    }
    switch(label)
    {
      case 'Bant':
        return card.colors.includes('W') && card.colors.includes('U') && card.colors.includes('G');
      case 'Esper':
        return card.colors.includes('B') && card.colors.includes('U') && card.colors.includes('W');
      case 'Grixis':
        return card.colors.includes('B') && card.colors.includes('R') && card.colors.includes('U');
      case 'Jund':
        return card.colors.includes('G') && card.colors.includes('R') && card.colors.includes('B');
      case 'Naya':
        return card.colors.includes('W') && card.colors.includes('G') && card.colors.includes('R');
      case 'Abzan':
        return card.colors.includes('W') && card.colors.includes('B') && card.colors.includes('G');
      case 'Jeskai':
        return card.colors.includes('R') && card.colors.includes('U') && card.colors.includes('W');
      case 'Sultai':
        return card.colors.includes('G') && card.colors.includes('B') && card.colors.includes('U');
      case 'Mardu':
        return card.colors.includes('W') && card.colors.includes('R') && card.colors.includes('B');
      case 'Temur':
        return card.colors.includes('G') && card.colors.includes('U') && card.colors.includes('R');
    }
  }
  else if(sort == 'Color Count')
  {
    return card.colors.length == parseInt(label);
  }
  else if (sort == 'Set')
  {
    return card.details.set.toUpperCase() == label;
  }
  else if (sort == 'Rarity')
  {
    return card.details.rarity.toLowerCase() == label.toLowerCase();
  }
  else if(sort == 'Unsorted')
  {
    return true;
  }
  else if(sort == 'Subtype')
  {
    if(card.details.type.includes('—'))
    {
      return card.details.type.includes(label);
    }
    return false;
  }
  else if(sort =='Types-Multicolor')
  {
    if(card.colors.length <= 1)
    {
      var split1 = card.details.type.split('—');
      var split2 = split1[0].trim().split(' ');
      return label == split2[split2.length-1];
    }
    else
    {
      return cardIsLabel(card, label, 'Guilds') || cardIsLabel(card, label, 'Shards / Wedges') || cardIsLabel(card, label, '4+ Color');
    }
  }
  else if (sort == 'Artist')
  {
    return card.details.artist == label;
  }
  else if(sort == 'Legality')
  {
    if(label=='Vintage')
    {
      return true;
    }
    return card.details.legalities[label];
  }
  else if (sort == 'Power')
  {
    if(card.details.power)
    {
      return card.details.power == label;
    }
    return false;
  }
  else if (sort == 'Toughness')
  {
    if(card.details.toughness)
    {
      return card.details.toughness == label;
    }
    return false;
  }
  else if (sort == 'Loyalty')
  {
    if(card.details.loyalty)
    {
      return card.details.loyalty == label;
    }
    return false;
  }
}


//true if card is filtered IN
function filterCard(card, filterobj)
{
  //first filter out everything in this category
  //then filter in everything that matches one of the ins

  var filterout = false;
  var filterin = false;
  var hasFilterIn = false;
  for (var category in filterobj)
  {
    if (filterobj.hasOwnProperty(category))
    {
      filterobj[category].out.forEach(function(option, index)
      {
        if(cardIsLabel(card,option.value,option.category))
        {
          filterout = true;
        }
      });
      if(!filterout)
      {
        filterobj[category].in.forEach(function(option, index)
        {
          hasFilterIn = true;
          if(cardIsLabel(card,option.value,option.category))
          {
            filterin = true;
          }
        });
      }
    }
  }
  if(filterout)
  {
    return false;
  }
  if(!hasFilterIn)
  {
    return true;
  }
  return filterin;
}

function setCubeType(cube)
{
  var pauper = true;
  var type = legalityToInt('Standard');
  cube.cards.forEach(function(card, index)
  {
    if(pauper && !carddict[card.cardID].legalities.Pauper)
    {
      pauper = false;
    }
    while(type>0 && !carddict[card.cardID].legalities[intToLegality(type)])
    {
      type -= 1;
    }
  });

  cube.type = intToLegality(type);
  if(pauper)
  {
    cube.type += ' Pauper';
  }
  cube.card_count = cube.cards.length;
  return cube;
}

function intToLegality(val)
{
  switch(val)
  {
    case 0:
      return 'Vintage';
    case 1:
      return 'Legacy';
    case 2:
      return 'Modern';
    case 3:
      return 'Standard';
  }
  return cube;
}

//vintage < legacy < modern < standard
function legalityToInt(legality)
{
  switch(legality)
  {
    case 'Vintage':
      return 0;
    case 'Legacy':
      return 1;
    case 'Modern':
      return 2;
    case 'Standard':
      return 3;
  }
}

function sanitize(html)
{
  return sanitizeHtml(html, {
    allowedTags: [ 'div','p','strike','strong','b', 'i', 'em', 'u', 'a', 'h5','h6','ul','ol','li','span'],
    selfClosing: [ 'br']
  });
}

function addAutocard(src)
{
  while(src.includes('[[') && src.includes(']]') && src.indexOf('[[') < src.indexOf(']]'))
  {
    var cardname = src.substring(src.indexOf('[[')+2,src.indexOf(']]'));
    var mid = cardname;
    if(nameToId[cardname.toLowerCase()])
    {
      var card = carddict[nameToId[cardname.toLowerCase()][0]];
      if(card.image_flip)
      {
        mid = '<a class="autocard" card="'+ card.image_normal + '" card_flip="'+ card.image_flip + '">' +  card.name + '</a>';
      }
      else
      {
        mid = '<a class="autocard" card="'+ card.image_normal + '">' +  card.name + '</a>';
      }
    }
    //front + autocard + back
    src = src.substring(0,src.indexOf('[['))
      + mid
      + src.substring(src.indexOf(']]')+2);
  }
  return src;
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
