const cheerio = require('cheerio');
const rp = require('request-promise');

const carddb = require('../../serverjs/cards.js');
const cubefn = require('../../serverjs/cubefn.js');
const util = require('../../serverjs/util.js');

const { ensureAuth } = util;
const { sanitize, setCubeType } = cubefn;

const express = require('express');
const router = express.Router();

const Blog = require('../../models/blog');
const Cube = require('../../models/cube');
const User = require('../../models/user');

// Edit Submit POST Route
router.post('/editoverview/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/overview/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/overview/' + req.params.id);
    } else {
      var image = carddb.imagedict[req.body.imagename.toLowerCase()];
      var name = req.body.name;

      if (name.length < 5) {
        req.flash('danger', 'Cube name should be at least 5 characters long.');
        res.redirect('/cube/overview/' + req.params.id);
      } else {
        if (image) {
          cube.image_uri = image.uri;
          cube.image_artist = image.artist;
          cube.image_name = req.body.imagename;
        }
        cube.descriptionhtml = req.body.html;
        cube.name = name;
        cube.isListed = req.body.isListed ? true : false;
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString("en-US");

        cube = setCubeType(cube, carddb);
        cube.save(function(err) {
          if (err) {
            req.flash('danger', 'Server Error');
            res.redirect('/cube/overview/' + req.params.id);
          } else {
            req.flash('success', 'Cube updated successfully.');
            res.redirect('/cube/overview/' + req.params.id);
          }
        });
      }
    }
  });
});

// Edit Submit POST Route
router.post('/edit/:id', ensureAuth, function(req, res) {
  req.body.blog = sanitize(req.body.blog);
  Cube.findById(req.params.id, function(err, cube) {
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString("en-US");
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/list/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/list/' + req.params.id);
    } else {
      var edits = req.body.body.split(';');
      var fail_remove = [];
      var adds = [];
      var removes = [];
      var changelog = "";
      edits.forEach(function(edit, index) {
        if (edit.charAt(0) == '+') {
          //add id
          var details = carddb.carddict[edit.substring(1)];
          if (!details) {
            console.log('Card not found: ' + edit, req);
          } else {
            util.addCardToCube(cube, details);
            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
            if (carddb.carddict[edit.substring(1)].image_flip) {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[edit.substring(1)].image_normal + '" card_flip="' + carddb.carddict[edit.substring(1)].image_flip + '">' + carddb.carddict[edit.substring(1)].name + '</a>';
            } else {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[edit.substring(1)].image_normal + '">' + carddb.carddict[edit.substring(1)].name + '</a>';
            }
          }
        } else if (edit.charAt(0) == '-') {
          //remove id
          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index) {
            if (rm_index == -1) {
              if (card_to_remove.cardID == edit.substring(1)) {
                rm_index = remove_index;
              }
            }
          });
          if (rm_index != -1) {
            cube.cards.splice(rm_index, 1);

            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-danger">–</span> ';
            if (carddb.carddict[edit.substring(1)].image_flip) {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[edit.substring(1)].image_normal + '" card_flip="' + carddb.carddict[edit.substring(1)].image_flip + '">' + carddb.carddict[edit.substring(1)].name + '</a>';
            } else {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[edit.substring(1)].image_normal + '">' + carddb.carddict[edit.substring(1)].name + '</a>';
            }
          } else {
            fail_remove.push(edit.substring(1));
          }
        } else if (edit.charAt(0) == '/') {
          var tmp_split = edit.substring(1).split('>');
          var details = carddb.carddict[tmp_split[1]];
          util.addCardToCube(cube, details);

          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index) {
            if (rm_index == -1) {
              if (card_to_remove.cardID == tmp_split[0]) {
                rm_index = remove_index;
              }
            }
          });
          if (rm_index != -1) {
            cube.cards.splice(rm_index, 1);

            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-primary">→</span> ';
            if (carddb.carddict[tmp_split[0]].image_flip) {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[0]].image_normal + '" card_flip="' + carddb.carddict[tmp_split[0]].image_flip + '">' + carddb.carddict[tmp_split[0]].name + '</a> > ';
            } else {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[0]].image_normal + '">' + carddb.carddict[tmp_split[0]].name + '</a> > ';
            }
            if (carddb.carddict[tmp_split[1]].image_flip) {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[1]].image_normal + '" card_flip="' + carddb.carddict[tmp_split[1]].image_flip + '">' + carddb.carddict[tmp_split[1]].name + '</a>';
            } else {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[1]].image_normal + '">' + carddb.carddict[tmp_split[1]].name + '</a>';
            }
          } else {
            fail_remove.push(tmp_split[0]);
            changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
            if (carddb.carddict[tmp_split[1]].image_flip) {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[1]].image_normal + '" card_flip="' + carddb.carddict[tmp_split[1]].image_flip + '">' + carddb.carddict[tmp_split[1]].name + '</a>';
            } else {
              changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[tmp_split[1]].image_normal + '">' + carddb.carddict[tmp_split[1]].name + '</a>';
            }
          }
        }
        changelog += '<br>';
      });

      var blogpost = new Blog();
      blogpost.title = req.body.title;
      if (req.body.blog.length > 0) {
        blogpost.html = req.body.blog;
      }
      blogpost.changelist = changelog;
      blogpost.owner = cube.owner;
      blogpost.date = Date.now();
      blogpost.cube = cube._id;
      blogpost.dev = 'false';
      blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

      blogpost.save(function(err) {
        if (err) {
          console.log(err);
        } else {
          if (fail_remove.length > 0) {
            var errors = ""
            fail_remove.forEach(function(fail, index) {
              if (carddb.carddict[fail]) {
                if (index != 0) {
                  errors += ", ";
                }
                errors += carddb.carddict[fail].name;
              } else {
                console.log('ERROR: Could not find the card with ID: ' + fail, req);
              }
            });
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                console.log(err);
              } else {
                req.flash('warning', 'Cube Updated With Errors, could not remove the following cards: ' + errors);
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          } else {
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                console.log(err);
              } else {
                req.flash('success', 'Cube Updated');
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          }
        }
      });
    }
  });
});

router.post('/importcubetutor/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      console.log(err, req);
    } else {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        if (isNaN(req.body.cubeid)) {
          req.flash('danger', 'Error: Provided ID is not in correct format.');
          res.redirect('/cube/list/' + req.params.id);
        } else {

          const options = {
            uri: 'http://www.cubetutor.com/viewcube/' + req.body.cubeid,
            transform: function(body) {
              return cheerio.load(body);
            },
            headers: {
              //this tricks cubetutor into not redirecting us to the unsupported browser page
              'User-Agent': 'Mozilla/5.0'
            },
          };
          rp(options).then(function(data) {
              var cards = [];
              var unknown = [];
              data('.cardPreview').each(function(i, elem) {
                var str = elem.attribs['data-image'].substring(37, elem.attribs['data-image'].length - 4);
                if (!str.includes('/')) {
                  cards.push({
                    set: 'unknown',
                    name: decodeURIComponent(elem.children[0].data).replace('_flip', '')
                  })
                } else {
                  var split = str.split('/');
                  cards.push({
                    set: split[0],
                    name: decodeURIComponent(elem.children[0].data).replace('_flip', '')
                  })
                }
              });
              var added = [];
              var missing = "";
              var changelog = "";
              cards.forEach(function(card, index) {
                var currentId = carddb.nameToId[card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()];
                if (currentId && currentId[0]) {
                  var found = false;
                  currentId.forEach(function(possible, index) {
                    if (!found && carddb.carddict[possible].set.toUpperCase() == card.set) {
                      found = true;
                      added.push(carddb.carddict[possible]);
                      var details = carddb.carddict[possible];
                      util.addCardToCube(cube, details);
                      changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                      if (carddb.carddict[possible].image_flip) {
                        changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[possible].image_normal + '" card_flip="' + carddb.carddict[possible].image_flip + '">' + carddb.carddict[possible].name + '</a></br>';
                      } else {
                        changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[possible].image_normal + '">' + carddb.carddict[possible].name + '</a></br>';
                      }
                    }
                  });
                  if (!found) {
                    added.push(carddb.carddict[currentId[0]]);
                    var details = carddb.carddict[currentId[0]];
                    cube.cards.push({
                      tags: ['New'],
                      status: "Not Owned",
                      colors: details.color_identity,
                      cmc: details.cmc,
                      cardID: currentId[0],
                      type_line: details.type
                    });
                    changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                    if (carddb.carddict[currentId[0]].image_flip) {
                      changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '" card_flip="' + carddb.carddict[currentId[0]].image_flip + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
                    } else {
                      changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
                    }
                  }
                } else {
                  missing += card.name + '\n';
                }
              });

              var blogpost = new Blog();
              blogpost.title = 'Cubetutor Import - Automatic Post'
              blogpost.html = changelog;
              blogpost.owner = cube.owner;
              blogpost.date = Date.now();
              blogpost.cube = cube._id;
              blogpost.dev = 'false';
              blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

              if (missing.length > 0) {
                res.render('cube/bulk_upload', {
                  missing: missing,
                  added: JSON.stringify(added),
                  cube,
                  user: {
                    id: req.user._id,
                    username: req.user.username
                  }
                });
              } else {
                blogpost.save(function(err) {
                  cube = setCubeType(cube, carddb);
                  Cube.updateOne({
                    _id: cube._id
                  }, cube, function(err) {
                    if (err) {
                      req.flash('danger', 'Error adding cards. Please try again.');
                      res.redirect('/cube/list/' + req.params.id);
                    } else {
                      req.flash('success', 'All cards successfully added.');
                      res.redirect('/cube/list/' + req.params.id);
                    }
                  });
                });
              }
            })
            .catch(function(err) {
              console.log(err, req);
              req.flash('danger', 'Error: Unable to import this cube.');
              res.redirect('/cube/list/' + req.params.id);
            });
        }
      }
    }
  });
});

router.post('/bulkupload/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      console.log(err, req);
    } else {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        bulkUpload(req, res, req.body.body, cube);
      }
    }
  });
});

router.post('/bulkuploadfile/:id', ensureAuth, function(req, res) {
  if (!req.files) {
    req.flash('danger', 'Please attach a file');
    res.redirect('/cube/list/' + req.params.id);
  } else {
    items = req.files.document.data.toString('utf8'); // the uploaded file object

    Cube.findById(req.params.id, function(err, cube) {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        bulkUpload(req, res, items, cube);
      }
    });
  }
});

function bulkuploadCSV(req, res, cards, cube) {
  var added = [];
  var missing = "";
  var changelog = "";
  cards.forEach(function(card_raw, index) {
    var split = util.CSVtoArray(card_raw);
    var card = {
      name: split[0],
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split(''),
      set: split[4].toUpperCase(),
      status: split[5],
      tags: split[6].split(',')
    };
    var currentId = carddb.nameToId[card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()];
    if (currentId && currentId[0]) {
      var found = false;
      currentId.forEach(function(possible, index) {
        if (!found && carddb.carddict[possible].set.toUpperCase() == card.set) {
          found = true;
          added.push(carddb.carddict[possible]);
          var details = carddb.carddict[possible];
          cube.cards.push({
            tags: card.tags,
            status: card.status,
            colors: card.colors,
            cmc: card.cmc,
            cardID: possible,
            type_line: card.type_line
          });
          changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
          if (carddb.carddict[possible].image_flip) {
            changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[possible].image_normal + '" card_flip="' + carddb.carddict[possible].image_flip + '">' + carddb.carddict[possible].name + '</a></br>';
          } else {
            changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[possible].image_normal + '">' + carddb.carddict[possible].name + '</a></br>';
          }
        }
      });
      if (!found) {
        added.push(carddb.carddict[currentId[0]]);
        var details = carddb.carddict[currentId[0]];
        cube.cards.push({
          tags: card.tags,
          status: card.status,
          colors: card.colors,
          cmc: card.cmc,
          cardID: currentId[0],
          type_line: card.type_line
        });
        changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
        if (carddb.carddict[currentId[0]].image_flip) {
          changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '" card_flip="' + carddb.carddict[currentId[0]].image_flip + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
        } else {
          changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
        }
      }
    } else {
      missing += card.name + '\n';
    }
  });

  var blogpost = new Blog();
  blogpost.title = 'Cube Bulk Import - Automatic Post'
  blogpost.html = changelog;
  blogpost.owner = cube.owner;
  blogpost.date = Date.now();
  blogpost.cube = cube._id;
  blogpost.dev = 'false';
  blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

  //
  if (missing.length > 0) {
    res.render('cube/bulk_upload', {
      missing: missing,
      added: JSON.stringify(added),
      cube,
      user: {
        id: req.user._id,
        username: req.user.username
      }
    });
  } else {
    blogpost.save(function(err) {
      cube = setCubeType(cube, carddb);
      Cube.updateOne({
        _id: cube._id
      }, cube, function(err) {
        if (err) {
          req.flash('danger', 'Error adding cards. Please try again.');
          res.redirect('/cube/list/' + req.params.id);
        } else {
          req.flash('success', 'All cards successfully added.');
          res.redirect('/cube/list/' + req.params.id);
        }
      });
    });
  }
}

function bulkUpload(req, res, list, cube) {
  cards = list.match(/[^\r\n]+/g);
  if (cards) {
    if (cards[0].trim() == 'Name,CMC,Type,Color,Set,Status,Tags') {
      cards.splice(0, 1);
      bulkuploadCSV(req, res, cards, cube);
    } else {
      cube.date_updated = Date.now();
      cube.updated_string = cube.date_updated.toLocaleString("en-US");
      if (!cards) {
        req.flash('danger', 'No Cards Detected');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        var missing = "";
        var added = [];
        var changelog = "";
        for (i = 0; i < cards.length; i++) {
          item = cards[i].toLowerCase().trim();
          if (/([0-9]+x )(.*)/.test(item)) {
            var count = parseInt(item.substring(0, item.indexOf('x')));
            for (j = 0; j < count; j++) {
              cards.push(item.substring(item.indexOf('x') + 1));
            }
          } else {
            if (/(.*)( \((.*)\))/.test(item)) {
              //has set info
              if (carddb.nameToId[item.toLowerCase().substring(0, item.indexOf('(')).trim()]) {
                var name = item.toLowerCase().substring(0, item.indexOf('(')).trim();
                var set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'))
                //if we've found a match, and it DOES need to be parsed with cubecobra syntax
                var found = false;
                var possibilities = carddb.nameToId[name];
                possibilities.forEach(function(possible, ind) {
                  if (!found && carddb.carddict[possible].set.toLowerCase() == set) {
                    var details = carddb.carddict[possible];
                    util.addCardToCube(cube, details, details);
                    added.push(details);
                    found = true;
                  }
                });
                if (!found) {
                  missing += item + '\n';
                }
              } else {
                //we didn't find a match for this item
                missing += item + '\n';
              }
            } else {
              //does not have set info
              var currentId = carddb.nameToId[item.toLowerCase().trim()];
              if (currentId && currentId[0]) {
                //if we've found a match, and it doesn't need to be parsed with cubecobra syntax
                var details = carddb.carddict[currentId[0]];
                util.addCardToCube(cube, details);
                added.push(details);
                changelog += '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ';
                if (carddb.carddict[currentId[0]].image_flip) {
                  changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '" card_flip="' + carddb.carddict[currentId[0]].image_flip + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
                } else {
                  changelog += '<a class="dynamic-autocard" card="' + carddb.carddict[currentId[0]].image_normal + '">' + carddb.carddict[currentId[0]].name + '</a></br>';
                }
              } else {
                //we didn't find a match for this item
                missing += item + '\n';
              }
            }
          }
        }

        var blogpost = new Blog();
        blogpost.title = 'Cube Bulk Import - Automatic Post'
        blogpost.html = changelog;
        blogpost.owner = cube.owner;
        blogpost.date = Date.now();
        blogpost.cube = cube._id;
        blogpost.dev = 'false';
        blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

        //
        if (missing.length > 0) {
          res.render('cube/bulk_upload', {
            missing: missing,
            added: JSON.stringify(added),
            cube,
            user: {
              id: req.user._id,
              username: req.user.username
            }
          });
        } else {
          blogpost.save(function(err) {
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                req.flash('danger', 'Error adding cards. Please try again.');
                res.redirect('/cube/list/' + req.params.id);
              } else {
                req.flash('success', 'All cards successfully added.');
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          });
        }
      }
    }
  } else {
    req.flash('danger', 'Error adding cards. Invalid format.');
    res.redirect('/cube/list/' + req.params.id);
  }
}

router.post('/api/updatecard/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (cube.owner === req.body._id) {
      var found = false;
      cube.cards.forEach(function(card, index) {
        if (!card.type_line) {
          card.type_line = carddb.carddict[card.cardID].type;
        }
        if (!found && cardsAreEquivalent(card, req.body.src, carddb)) {
          found = true;
          cube.cards[index] = req.body.updated;
        }
      });
      if (!found) {
        res.status(400).send({
          success: 'false',
          message: 'Card not found'
        });
      } else {
        cube = setCubeType(cube, carddb);
        cube.save(function(err) {
          if (err) {
            res.status(500).send({
              success: 'false',
              message: 'Error saving cube'
            });
          } else {
            res.status(200).send({
              success: 'true'
            });
          }
        });
      }
    }
  });
});

router.post('/api/updatecards/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (cube.owner === req.user._id) {
        var found = false;
        req.body.selected.forEach(function(select, index) {
          if (!cube.cards[select.index].type_line) {
            cube.cards[select.index].type_line = carddb.carddict[cube.cards[select.index].cardID].type;
          }
          if (cube.cards[select.index].details) {
            delete cube.cards[select.index].details;
          }
          if (req.body.updated.status) {
            cube.cards[select.index].status = req.body.updated.status;
          }
          if (req.body.updated.cmc) {
            cube.cards[select.index].cmc = req.body.updated.cmc;
          }
          if (req.body.updated.type_line) {
            cube.cards[select.index].type_line = req.body.updated.type_line;
          }
          if (req.body.updated.colors) {
            cube.cards[select.index].colors = req.body.updated.colors;
          }
          if (req.body.updated.tags) {
            cube.cards[select.index].tags.forEach(function(tag, ind) {
              cube.cards[select.index].tags[ind] = tag.trim();
            });
            if (req.body.updated.addTags) {
              req.body.updated.tags.forEach(function(newtag, tag_ind) {
                if (!cube.cards[select.index].tags.includes(newtag)) {
                  cube.cards[select.index].tags.push(newtag);
                }
              });
            } else {
              //remove the tags
              req.body.updated.tags.forEach(function(tag, tag_in) {
                var temp = cube.cards[index].tags.indexOf(tag);
                if (temp > -1) {
                  cube.cards[index].tags.splice(temp, 1);
                }
              });
            }
          }
        });
        cube.save(function(err) {
          if (err) {
            res.status(500).send({
              success: 'false',
              message: 'Error saving cube'
            });
          } else {
            res.status(200).send({
              success: 'true'
            });
          }
        });
    }
  });
});

module.exports = router;
