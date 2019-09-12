var sortItemTemplate = '<option value="#{value}">#{label}</option>';
var canEdit = $('#edittoken').val();
var listGranularity = 50;
var listPosition = 0;
var changes = [];
var sorts = [];
var filters = [];
var groupSelect = null;
var modalSelect = null;
var view = $('#viewSelect').val();
var show_tag_colors = $('#hideTagColors').val() !== 'true';

var comparing = false;
if ($('#in_both').length) {
  comparing = true;
  var in_both = JSON.parse($('#in_both').val());
  var only_a = JSON.parse($('#only_a').val());
  var only_b = JSON.parse($('#only_b').val());
  view = 'table';
}

var cubeDict = {},
  hasCustomImages = false;
$("#customImageDisplayMenuItem").hide();
var cube = JSON.parse($('#cuberaw').val());
cube.forEach(function(card, index) {
  card.index = index;
  cubeDict[index] = card;
  if (!hasCustomImages && card.imgUrl !== undefined) {
    hasCustomImages = true;
    $("#customImageDisplayToggle").prop("checked", true);
    $("#customImageDisplayMenuItem").show();
  }
});
var cubeTagColors = JSON.parse($('#cubeTagColors').val());

$('#compareInput').keypress(function(e) {
  if (e.which == 13) {
    $('#compareButton').click();
    return false;
  }
});

$('#compareButton').click(function(e) {
  const id_a = $('#cubeID').val();
  let id_b = $('#compareInput').val();
  if (id_b.includes('/')) {
    let parts = id_b.split('/');
    id_b = parts[parts.length - 1];
  }
  if (id_b) window.location.href = '/cube/compare/' + id_a + '/to/' + id_b;
});

$('#filterButton').click(function(e) {
  var filterText = $('#filterInput').val();
  updateFilters(filterText);
});

$('.updateButton').click(function(e) {
  updateCubeList();
});

$('#filterInput').keyup(function(e) {
  if (e.keyCode === 13) {
    e.preventDefault();
    filterButton.click();
  }
});

$('#resetButton').click(function(e) {
  filters = [];
  updateCubeList();
});

$('#customImageDisplayToggle').click(function(e) {
  console.log("clicked");
  var enabled = $(this).prop('checked'),
    display_image;
  cube.forEach(function(card, index) {
    adjustDisplayImage(card, enabled);
  });
  updateCubeList();
});

$('#viewSelect').change(function(e) {
  view = $('#viewSelect').val();
  updateCubeList();
});

if (canEdit) {
  $('#justAddButton').click(function(e) {
    justAdd()
  });
  $('#removeButton').click(function(e) {
    remove();
  });
  $('#saveChangesButton').click(function(e) {
    $('#changelistBlog').val($('#editor').html());
    var val = '';
    changes.forEach(function(change, index) {
      if (index != 0) {
        val += ';';
      }
      if (change.add) {
        val += '+' + change.add._id;
      } else if (change.remove) {
        val += '-' + change.remove._id;
      } else if (change.replace) {
        val += '/' + change.replace[0]._id + '>';
        val += change.replace[1]._id;
      }
    });
    $('#changelistFormBody').val(val);
    document.getElementById("changelistForm").submit();
  });
  $('#discardAllButton').click(function(e) {
    changes = [];
    updateCollapse();
  });
  $('#addInput').keyup(function(e) {
    if (e.keyCode === 13 && $('#addInput').val().length == 0) {
      e.preventDefault();
      justAdd();
    }
  });
  $('#removeInput').keyup(function(e) {
    if (e.keyCode === 13 && $('#removeInput').val().length == 0) {
      e.preventDefault();
      remove();
    }
  });
  $('#contextModalVersionSelect').change(function(e) {
    fetch('/cube/api/getcardfromid/' + e.target.value)
      .then(response => response.json())
      .then(function(json) {
        $('#contextModalImg').attr('src', json.card.image_normal);
        var priceHtml = '';
        if (json.card.price) {
          priceHtml += '<div class="card-price"><a>TCGPlayer Market: $' + json.card.price.toFixed(2) + '</a></div>';
        }
        if (json.card.price_foil) {
          priceHtml += '<div class="card-price"><a>Foil TCGPlayer Market: $' + json.card.price_foil.toFixed(2) + '</a></div>';
        }
        $('.price-area').html(priceHtml);
      });
  });
  $('#groupContextModalSubmit').click(function(e) {

    //if we typed a tag but didn't hit enter, register that tag
    if ($('#groupContextTags').find('.main-input').val().length > 0) {
      var tag = $('#groupContextTags').find('.main-input').val();
      $('#groupContextTags').find('.main-input').val('');
      var val = $('#groupContextTags').find('.hidden-input').val();
      if (val.length > 0) {
        val += ', ' + tag;
      } else {
        val = tag;
      }
      $('#groupContextTags').find('.hidden-input').val(val);
      $('#groupContextTags').find('.hidden-input').trigger('change');
    }
    updated = {
      addTags: $('#groupContextAdd').prop('checked')
    };

    tags_split = $('#groupContextTags').find('.hidden-input').val().split(',');
    tags_split.forEach(function(tag, index) {
      tags_split[index] = tags_split[index].trim();
    });
    updated.tags = tags_split;

    var val = $('#groupContextModalStatusSelect').val();
    if (val.length > 0) {
      updated.status = val;
    }
    val = $('#groupContextModalCMC').val();
    if (val.length > 0) {
      updated.cmc = val;
    }
    val = $('#groupContextModalType').val().replace('-', '—');
    if (val.length > 0) {
      updated.type_line = val;
    }
    val = [];
    ['W', 'U', 'B', 'R', 'G', 'C'].forEach(function(color, index) {
      if ($('#groupContextModalCheckbox' + color).prop('checked')) {
        val.push(color);
      }
    });
    if (val.length > 0) {
      if (val.indexOf('C') === 0 && val.length === 1) {
        updated.colors = [];
      } else {
        updated.colors = val;
      }
    }

    //TODO: Remove this
    var filterobj = null;
    if (filters.length > 0) {
      filterobj = getFilterObj();
    }

    groupSelect = JSON.parse(JSON.stringify(groupSelect));

    groupSelect.forEach(function(card, index) {
      delete card.details;
    });

    let data = {
      selected: groupSelect,
      //filters: filterobj,
      updated: updated,
    };

    fetch("/cube/api/updatecards/" + $('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      groupSelect.forEach(function(card, index) {
        if (updated.status) {
          cube[card.index].status = updated.status;
        }
        if (updated.cmc) {
          cube[card.index].cmc = updated.cmc;
        }
        if (updated.type_line) {
          cube[card.index].type_line = updated.type_line;
        }
        if (updated.colors) {
          cube[card.index].colors = updated.colors;
        }
        if (updated.tags) {
          cube[card.index].tags.forEach(function(tag, ind) {
            cube[card.index].tags[ind] = tag.trim();
          });
          if (updated.addTags) {
            updated.tags.forEach(function(newtag, tag_ind) {
              if (!cube[card.index].tags.includes(newtag)) {
                cube[card.index].tags.push(newtag);
              }
            });
          } else {
            //remove the tags
            updated.tags.forEach(function(tag, tag_in) {
              var temp = cube[card.index].tags.indexOf(tag);
              if (temp > -1) {
                cube[card.index].tags.splice(temp, 1);
              }
            });
          }
        }
      });
      updateCubeList();
      $('#groupContextModal').modal('hide');
    });
  });
  $('#groupContextRemoveButton').click(function(e) {
    groupSelect.forEach(function(card, index) {
      changes.push({
        remove: card.details
      })
    });
    updateCollapse();
    $('#groupContextModal').modal('hide');
    $('#navedit').collapse("show");
    $('.warnings').collapse("hide");
  });
  $('#contextRemoveButton').click(function(e) {
    changes.push({
      remove: modalSelect.details
    })
    updateCollapse();
    $('#contextModal').modal('hide');
    $('#navedit').collapse("show");
    $('.warnings').collapse("hide");
  });
  $('#contextModalSubmit').click(function(e) {
    //if we typed a tag but didn't hit enter, register that tag
    if ($('#contextTags').find('.main-input').val().length > 0) {
      var tag = $('#contextTags').find('.main-input').val();
      $('#contextTags').find('.main-input').val('');
      var val = $('#contextTags').find('.hidden-input').val();
      if (val.length > 0) {
        val += ', ' + tag;
      } else {
        val = tag;
      }
      $('#contextTags').find('.hidden-input').val(val);
      $('#contextTags').find('.hidden-input').trigger('change');
    }

    updated = {};

    tags_split = $('#contextTags').find('.hidden-input').val().split(',');
    tags_split.forEach(function(tag, index) {
      tags_split[index] = tags_split[index].trim();
    });
    while (tags_split.includes("")) {
      tags_split.splice(tags_split.indexOf(""), 1);
    }
    updated.tags = tags_split;
    updated.colors = [];

    ['W', 'U', 'B', 'R', 'G'].forEach(function(color, index) {
      if ($('#contextModalCheckbox' + color).prop('checked')) {
        updated.colors.push(color);
      }
    });

    updated.status = $('#contextModalStatusSelect').val();
    updated.cardID = $('#contextModalVersionSelect').val();
    updated.cmc = $('#contextModalCMC').val();
    updated.type_line = $('#contextModalType').val().replace('-', '—');
    updated.imgUrl = $('#contextModalImageURL').val();
    if (updated.imgUrl === "") {
      updated.imgUrl = null;
    }

    let data = {
      src: modalSelect,
      updated: updated,
    };
    fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    fetch('/cube/api/getcardfromid/' + updated.cardID)
      .then(response => response.json())
      .then(function(json) {
        var found = false;
        cube.forEach(function(card, index) {
          if (!found && card.index == data.src.index) {
            found = true;
            Object.keys(updated).forEach(function(key) {
              if (updated[key] === null) {
                updated[key] = undefined;
              }
            });
            cube[index] = updated;
            cube[index].index = card.index;
            cube[index].details = json.card;
            cube[index].details.display_image = updated.imgUrl !== undefined ? updated.imgUrl : json.card.image_normal;
            cubeDict[cube[index].index] = cube[index];
          }
        });

        updateCubeList();
        $('#contextModal').modal('hide');
      });
  });
  $('#saveSortButton').click(function(e) {
    var temp_sorts = [];
    temp_sorts[0] = document.getElementById('primarySortSelect').value;
    temp_sorts[1] = document.getElementById('secondarySortSelect').value;
    let data = {
      sorts: temp_sorts,
    };
    fetch("/cube/api/savesorts/" + $('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      $('#cubeSaveModal').modal('show');
    });
  });
  $('#massEdit').click(function(e) {
    e.preventDefault();
    if (view == 'list') {
      groupSelect = [];
      cube.forEach(function(card, index) {
        if (card.checked) {
          groupSelect.push(card);
        }
      });
      if (groupSelect.length == 0) {
        $('#selectEmptyModal').modal('show');
      } else if (groupSelect.length == 1) {
        card = groupSelect[0];
        show_contextModal(card);
      } else {
        show_groupContextModal();
      }
    } else {
      $('#viewSelect').val('list').change();
    }
  });
}

$('#tagColors').click(function(e) {
  let b_id = $('#cubeB_ID').val();
  let query = (b_id) ? `?b_id=${b_id}` : '';
  fetch(`/cube/api/cubetagcolors/${$('#cubeID').val()}${query}`, {
    method: "GET",
    headers: {
      'Content-Type': 'application/json'
    },
    query: {
      b_id: $('#cubeB_ID').val(),
    },
  }).then(res => {
    res.json().then(data => {
      let html = '';
      let tag_colors = data.tag_colors;
      cubeTagColors = tag_colors;

      show_tag_colors = data.show_tag_colors;
      $('#showTagColorsCheckbox').prop("checked", show_tag_colors);

      const tag_color_options = [
        'Red',
        'Brown',
        'Orange',
        'Yellow',
        'Green',
        'Turquoise',
        'Blue',
        'Purple',
        'Violet',
        'Pink',
      ];

      tag_colors.forEach(function(item, index) {
        let tag = item.tag;
        let color = item.color;

        html += '<div class="row tag-color-row">'

        let tag_class = ''
        if (color) {
          tag_color_options.forEach(function(opt, index) {
            if (opt.toLowerCase() === color) {
              tag_class = `tag-color tag-${opt.toLowerCase()}`;
              return false;
            }
          });
        }

        html += '<div class="col">'
        html += `<div class="tag-item ${tag_class}">${tag}</div>`
        html += '</div>'

        if (canEdit && !comparing) {
          html += '<div class="col">'
          html += '<select class="tag-color-select">'
          html += '<option value="">No Color</option>'
          tag_color_options.forEach(function(opt, index) {
            const sel = (opt.toLowerCase() === color) ? 'selected' : '';
            html += `<option value="${opt}" ${sel}>${opt}</option>`
          })
          html += '</select>'
          html += '</div>'
        }

        html += '</div>'
      });
      $('#tagsColumn').html(html);

      if (canEdit && !comparing) {
        $('#tagsColumn').sortable({
          helper: function(e, item) {
            let copy = $(item).clone();
            $(copy).addClass('tag-sort-helper');
            return copy;
          },
          forcePlaceholderSize: true,
          placeholder: 'tag-sort-placeholder',
        });
      }
      $('#tagsColumn').disableSelection();

      if (canEdit && !comparing) {
        $('.tag-color-select').change(function() {
          let $item = $(this).parent().parent().find('.tag-item');
          tag_color_options.forEach(function(opt, index) {
            $item.removeClass(`tag-color tag-${opt.toLowerCase()}`);
          });
          if ($(this).val()) {
            $item.addClass(`tag-color tag-${$(this).val().toLowerCase()}`);
          }
        });
      }

      $('#tagColorsModal').modal('show');
    });
  });
});

$('#showTagColorsCheckbox').change(function(e) {
  fetch("/cube/api/saveshowtagcolors", {
    method: "POST",
    body: JSON.stringify({
      show_tag_colors: $(this).prop("checked"),
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(res => {
    show_tag_colors = $(this).prop("checked");
    updateCubeList();
  });
});

if (canEdit && !comparing) {
  $('#tagColorsSubmit').click(function(e) {
    let data = [];
    let tags = $('.tag-color-row .tag-item');
    let colors = $('.tag-color-row .tag-color-select');

    for (let i = 0; i < tags.length; i++) {
      let tag = $(tags[i]).html();
      let color = $(colors[i]).children('option:selected');
      color = (color.val()) ? color.val().toLowerCase() : null;
      data.push({
        tag,
        color
      });
    }

    fetch("/cube/api/savetagcolors/" + $('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      cubeTagColors = data;
      if (show_tag_colors) {
        updateCubeList();
      }
      $('#tagColorsModal').modal('hide');
    });
  });
}

function cardsAreEquivalent(card, details) {
  if (card.cardID != details.cardID) {
    return false;
  }
  if (card.status != details.status) {
    return false;
  }
  if (card.cmc != details.cmc) {
    return false;
  }
  if (card.type_line != details.type_line) {
    return false;
  }
  if (!arraysEqual(card.tags, details.tags)) {
    return false;
  }
  if (!arraysEqual(card.colors, details.colors)) {
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

function justAdd() {
  var val = $('#addInput').val().replace('?', '-q-');
  while (val.includes('//')) {
    val = val.replace('//', '-slash-');
  }
  if (val.length > 0) {
    fetch('/cube/api/getcard/' + val)
      .then(response => response.json())
      .then(function(json) {
        if (json.card) {
          $('#addInput').val('');
          changes.push({
            add: json.card
          })
          updateCollapse();
          $('.warnings').collapse("hide");
        } else {
          $('.warnings').collapse("show");
        }
      });
  }
}

function remove() {
  var val = $('#removeInput').val().replace('?', '-q-');
  while (val.includes('//')) {
    val = val.replace('//', '-slash-');
  }
  if (val.length > 0) {
    fetch('/cube/api/getcardfromcube/' + $('#cubeID').val() + ';' + val)
      .then(response => response.json())
      .then(function(json) {
        if (json.card) {
          if ($('#addInput').val().length > 0) {
            var val2 = $('#addInput').val().replace('?', '-q-');
            while (val2.includes('//')) {
              val2 = val2.replace('//', '-slash-');
            }
            fetch('/cube/api/getcard/' + val2)
              .then(response2 => response2.json())
              .then(function(json2) {
                if (json2.card) {
                  $('#addInput').val('');
                  $('#removeInput').val('');
                  changes.push({
                    replace: [json.card, json2.card]
                  })
                  updateCollapse();
                  $('.warnings').collapse("hide");
                } else {
                  $('.warnings').collapse("show");
                }
              });
          } else {
            $('#removeInput').val('');
            changes.push({
              remove: json.card
            })
            updateCollapse();
            $('.warnings').collapse("hide");
          }
        } else {
          $('.warnings').collapse("show");
        }
      });
  }
}

function updateCollapse() {
  var val = "";
  changes.forEach(function(change, index) {
    val += "<a class='clickx' id='clickx" + index + "' href=#>x</a> ";
    if (change.add) {
      val += '<span class="badge badge-success">+</span> ';
      if (change.add.image_flip) {
        val += '<a class="dynamic-autocard" card="' + change.add.image_normal + '" card_flip="' + change.add.image_flip + '">' + change.add.name + '</a>';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.add.image_normal + '">' + change.add.name + '</a>';
      }
    } else if (change.remove) {
      val += '<span class="badge badge-danger">–</span> ';
      if (change.remove.image_flip) {
        val += '<a class="dynamic-autocard" card="' + change.remove.image_normal + '" card_flip="' + change.remove.image_flip + '">' + change.remove.name + '</a>';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.remove.image_normal + '">' + change.remove.name + '</a>';
      }
    } else if (change.replace) {
      val += '<span class="badge badge-primary">→</span> ';
      if (change.replace[0].image_flip) {
        val += '<a class="dynamic-autocard" card="' + change.replace[0].image_normal + '" card_flip="' + change.replace[0].image_flip + '">' + change.replace[0].name + '</a> > ';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.replace[0].image_normal + '">' + change.replace[0].name + '</a> > ';
      }
      if (change.replace[1].image_flip) {
        val += '<a class="dynamic-autocard" card="' + change.replace[1].image_normal + '" card_flip="' + change.replace[1].image_flip + '">' + change.replace[1].name + '</a>';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.replace[1].image_normal + '">' + change.replace[1].name + '</a>';
      }
    }
    val += "<br>"
  });

  $('#changelist').html(val);

  if ($('#changelist').html().length > 0) {
    $('.editForm').collapse("show");
  } else {
    $('.editForm').collapse("hide")
  }

  autocard_init('dynamic-autocard');
  changes.forEach(function(change, index) {
    var clickx = document.getElementById("clickx" + index);
    clickx.addEventListener("click", function(e) {
      changes.splice(index, 1);
      updateCollapse();
    });
  });
}

function getCardTagColorClass(card) {
  let res = getCardColorClass(card);
  cubeTagColors.every(function(item, index) {
    if (card.tags.includes(item.tag)) {
      if (item.color) {
        res = `tag-color tag-${item.color}`;
        return false;
      }
    }
    return true;
  });
  return res;
}

function getTagColorClass(tag) {
  let res = 'tag-no-color'
  cubeTagColors.every(function(item, index) {
    if (item.tag === tag) {
      if (item.color) {
        res = `tag-color tag-${item.color}`;
        return false;
      }
    }
    return true;
  });
  return res;
}

function GetColorIdentity(colors) {
  if (colors.length == 0) {
    return 'Colorless';
  } else if (colors.length > 1) {
    return 'Multicolored';
  } else if (colors.length == 1) {
    switch (colors[0]) {
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

function getSorts() {
  return ['Artist', 'CMC', 'Color Category', 'Color Count', 'Color Identity', 'Color', 'Date Added', 'Guilds', 'Legality', 'Loyalty', 'Manacost Type', 'Power', 'Price', 'Price Foil', 'Rarity', 'Set', 'Shards / Wedges', 'Status', 'Subtype', 'Supertype', 'Tags', 'Toughness', 'Type', 'Types-Multicolor'];


}

function getLabels(sort) {
  if (sort == 'Color Category') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless', 'Lands'];
  } else if (sort == 'Color Identity') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  } else if (sort == 'CMC') {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
  } else if (sort == 'CMC2') {
    return ['0-1', '2', '3', '4', '5', '6', '7+'];
  } else if (sort == 'Color') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
  } else if (sort == 'Type') {
    return ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Conspiracy', 'Contraption', 'Phenomenon', 'Plane', 'Scheme', 'Vanguard', 'Land', 'Other'];
  } else if (sort == 'Supertype') {
    return ['Snow', 'Legendary', 'Tribal', 'Basic', 'Elite', 'Host', 'Ongoing', 'World'];
  } else if (sort == 'Tags') {
    var tags = [];
    cube.forEach(function(card, index) {
      card.tags.forEach(function(tag, index2) {
        if (tag.length > 0 && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });
    return tags.sort();
  } else if (sort == 'Date Added') {
    var days = [],
      formattedDay;
    cube.forEach(function(card, index) {
      formattedDay = ISODateToYYYYMMDD(card.addedTmsp);
      if (formattedDay === undefined) {
        formattedDay = "unknown";
      }
      if (!days.includes(formattedDay)) {
        days.push(formattedDay);
      }
    });
    return days.sort();
  } else if (sort == 'Status') {
    return ['Not Owned', 'Ordered', 'Owned', 'Premium Owned'];
  } else if (sort == 'Guilds') {
    return ['Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Golgari', 'Simic', 'Izzet', 'Boros'];
  } else if (sort == 'Shards / Wedges') {
    return ['Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Abzan', 'Jeskai', 'Sultai', 'Mardu', 'Temur'];
  } else if (sort == 'Color Count') {
    return ['0', '1', '2', '3', '4', '5'];
  } else if (sort == 'Set') {
    var sets = [];
    cube.forEach(function(card, index) {
      if (!sets.includes(card.details.set.toUpperCase())) {
        sets.push(card.details.set.toUpperCase());
      }
    });
    return sets.sort();
  } else if (sort == 'Artist') {
    var artists = [];
    cube.forEach(function(card, index) {
      if (!artists.includes(card.details.artist)) {
        artists.push(card.details.artist);
      }
    });
    return artists.sort();
  } else if (sort == 'Rarity') {
    return ['Common', 'Uncommon', 'Rare', 'Mythic'];
  } else if (sort == 'Unsorted') {
    return ['All'];
  } else if (sort == 'Subtype') {
    var types = [];
    cube.forEach(function(card, index) {
      if (card.type_line.includes('—')) {
        var subtypes = card.type_line.substr(card.type_line.indexOf('—') + 1).split(' ');
        subtypes.forEach(function(subtype, index) {
          if (!types.includes(subtype.trim()) && subtype.trim().length > 0) {
            types.push(subtype.trim());
          }
        });
      }
    });
    return types.sort();
  } else if (sort == 'Types-Multicolor') {
    return ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Conspiracy', 'Contraption', 'Phenomenon', 'Plane', 'Scheme', 'Vanguard', 'Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Golgari', 'Simic', 'Izzet', 'Boros',
      'Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Abzan', 'Jeskai', 'Sultai', 'Mardu', 'Temur', 'Non-White', 'Non-Blue', 'Non-Black', 'Non-Red', 'Non-Green', 'Five Color', 'Land', 'Other'
    ];
  } else if (sort == 'Legality') {
    return ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pauper'];
  } else if (sort == 'Power') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.power) {
        if (!items.includes(card.details.power)) {
          items.push(card.details.power);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!(/^\d+$/.test(x)) || !(/^\d+$/.test(y))) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Toughness') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.toughness) {
        if (!items.includes(card.details.toughness)) {
          items.push(card.details.toughness);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!(/^\d+$/.test(x)) || !(/^\d+$/.test(y))) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Loyalty') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.loyalty) {
        if (!items.includes(card.details.loyalty)) {
          items.push(card.details.loyalty);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!(/^\d+$/.test(x)) || !(/^\d+$/.test(y))) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Manacost Type') {
    return ['Gold', 'Hybrid', 'Phyrexian'];
  } else if (sort == 'CNC') {
    return ['Creature', 'Non-Creature'];
  } else if (sort == 'Price' || sort == 'Price Foil') {
    var labels = [];
    for (i = 0; i <= price_buckets.length; i++) {
      labels.push(price_bucket_label(i));
    }
    labels.push("No Price Available");
    return labels;
  }
}

function getCardColorClass(card) {
  var type = card.type_line;
  var colors = card.colors;
  if (type.toLowerCase().includes('land')) {
    return 'lands';
  } else if (colors.length == 0) {
    return 'colorless';
  } else if (colors.length > 1) {
    return 'multi';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case "W":
        return 'white';
        break;
      case "U":
        return 'blue';
        break;
      case "B":
        return 'black';
        break;
      case "R":
        return 'red';
        break;
      case "G":
        return 'green';
        break;
      case "C":
        return 'colorless';
        break;
    }
  }
}

function createMassEntry(cards) {
  var res = "";
  cards.forEach(function(card, index) {
    if (index != 0) {
      res += '||';
    }
    res += '1 ' + card.details.name;
  });
  return res;
}

function init_groupcontextModal() {
  $('.activateGroupContextModal').click(function(e) {
    e.preventDefault();
    var category1 = e.target.getAttribute("primarysort");
    var category2 = e.target.getAttribute("secondarysort");
    var matches = sortIntoGroups(sortIntoGroups(filteredCube(), sorts[0])[category1], sorts[1])[category2];
    if (matches.length == 1) {
      show_contextModal(matches[0]);
    } else {
      groupSelect = matches;
      show_groupContextModal();
    }
  });
}

function renderGroupContext() {

  var price = 0;
  var price_foil = 0;
  var cardlist = '<ul class="list-group list-outline" style="padding:0px 0px;">';
  groupSelect.forEach(function(card, index) {
    if (card.details.price) {
      price += card.details.price;
    }
    if (card.details.price_foil) {
      price_foil += card.details.price_foil;
    }
    let color_class = (show_tag_colors) ? getCardTagColorClass(card) : getCardColorClass(card);
    if (card.details.image_flip) {
      cardlist += '<li cardID="' + card.cardID + '" style="font-size: 15px;" class="card-list-item list-group-item autocard ' + color_class + '" card="' + card.details.display_image + '" card_flip="' + card.details.image_flip + '" card_tags="' + card.tags + '">';
    } else {
      cardlist += '<li cardID="' + card.cardID + '" style="font-size: 15px;" class="card-list-item list-group-item autocard ' + color_class + '" card="' + card.details.display_image + '" card_tags="' + card.tags + '">';
    }
    cardlist += '<a data-index="' + index + '" class="groupModalRm clickx" href="#">×</a><a>  ';
    cardlist += card.details.name;
    cardlist += '</a></li>';
  });
  cardlist += '</ul">';

  var priceHtml = '';
  if (price > 0) {
    priceHtml += '<div class="card-price"><a>TCGPlayer Market: $' + price.toFixed(2) + '</a></div>';
  }
  if (price_foil > 0) {
    priceHtml += '<div class="card-price"><a>Foil TCGPlayer Market: $' + price_foil.toFixed(2) + '</a></div>';
  }
  $('.price-area').html(priceHtml);

  $('#groupContextModalArea').html(cardlist);
  autocard_init('autocard');
  $('.groupModalRm').click(function(e) {
    e.preventDefault();
    groupSelect.splice($(this).attr('data-index'), 1);
    if (groupSelect.length < 1) {
      $('#groupContextModal').modal('hide');
    } else {
      renderGroupContext();
    }
  });
}

function show_groupContextModal() {
  $('#groupContextTags').find('.hidden-input').val('');
  $('#groupContextTags').find('.main-input').val('');
  $('#groupContextTags').find('.hidden-input').trigger('change');

  renderGroupContext();

  var statusHTML = "";
  var statuses = getLabels('Status');
  statusHTML += '<option selected value=""></option>';
  statuses.forEach(function(status, index) {
    statusHTML += '<option value="' + status + '">' + status + '</option>';
  });
  $('#groupContextModalStatusSelect').html(statusHTML);
  $('#groupContextBuyForm').attr('action', 'https://store.tcgplayer.com/massentry?partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
  $('#groupContextBuyHidden').val(createMassEntry(groupSelect));
  $('#groupContextModalCMC').val('');
  $('#groupContextModalType').val('');
  ['W', 'U', 'B', 'R', 'G'].forEach(function(color, index) {
    $('#groupContextModalCheckbox' + color).prop('checked', false);
  });

  $('#groupContextModal').modal('show');
}

function show_contextModal(card) {
  modalSelect = card;
  var priceHtml = '';
  if (card.details.price) {
    priceHtml += '<div class="card-price"><a>TCGPlayer Market: $' + card.details.price.toFixed(2) + '</a></div>';
  }
  if (card.details.price_foil) {
    priceHtml += '<div class="card-price"><a>Foil TCGPlayer Market: $' + card.details.price_foil.toFixed(2) + '</a></div>';
  }
  $('.price-area').html(priceHtml);
  $('#contextModalTitle').html(card.details.name);
  $('#contextModalImg').attr('src', card.details.display_image);
  if (card.details.image_flip !== undefined) {
    $('#contextModalImg').mouseover(function() {
      $(this).attr('src', card.details.image_flip);
    });
    $('#contextModalImg').mouseout(function() {
      $(this).attr('src', card.details.display_image);
    });
  }
  $('#contextModalVersionSelect').html('');
  var statusHTML = "";
  var statuses = getLabels('Status');
  statuses.forEach(function(status, index) {
    if (card.status == status) {
      statusHTML += '<option selected value="' + status + '">' + status + '</option>';
    } else {
      statusHTML += '<option value="' + status + '">' + status + '</option>';
    }
  });
  $('#contextModalStatusSelect').html(statusHTML);

  var tagsText = "";
  card.tags.forEach(function(tag, index) {
    if (index != 0) {
      tagsText += ', ';
    }
    tagsText += tag;
  });
  $('#contextTags').find('.hidden-input').val(tagsText);
  $('#contextTags').find('.hidden-input').trigger("change");

  $('#contextModalCMC').val(card.cmc);
  ['W', 'U', 'B', 'R', 'G'].forEach(function(color, index) {
    $('#contextModalCheckbox' + color).prop('checked', card.colors.includes(color));
  });

  $('#contextScryfallButton').attr('href', card.details.scryfall_uri);
  if (card.details.tcgplayer_id) {
    $('#contextBuyButton').attr('href', 'https://shop.tcgplayer.com/product/productsearch?id=' + card.details.tcgplayer_id + '&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
  } else {
    var name = card.details.name.replace('?', '-q-');
    while (name.includes('//')) {
      name = name.replace('//', '-slash-');
    }
    $('#contextBuyButton').attr('href', 'https://shop.tcgplayer.com/productcatalog/product/show?ProductName=' + name + '&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
  }
  $('#contextModalType').val(card.type_line);
  $('#contextModalImageURL').val(card.imgUrl);

  fetch('/cube/api/getversions/' + card.cardID)
    .then(response => response.json())
    .then(function(json) {
      var versionHTML = "";

      json.cards.forEach(function(version, index) {
        var name = version.full_name.toUpperCase().substring(version.full_name.indexOf('[') + 1, version.full_name.indexOf(']'));
        if (version._id == card.cardID) {
          versionHTML += '<option selected value="' + version._id + '">' + name + '</option>';
        } else {
          versionHTML += '<option value="' + version._id + '">' + name + '</option>';
        }
      });
      $('#contextModalVersionSelect').html(versionHTML);

      $('#contextModal').modal('show');
    });
}

function init_contextModal() {
  $('.activateContextModal').click(function(e) {
    e.preventDefault();
    card = cubeDict[$(this).attr("cardindex")];
    autocard_hide_card();
    show_contextModal(card);
  });
}

function sortIntoGroups(cards, sort) {
  var groups = {};
  var labels = getLabels(sort);
  labels.forEach(function(label, index) {
    group = [];

    cards.forEach(function(card, cardindex) {
      if (cardIsLabel(card, label, sort)) {
        group.push(card);
      }
    });

    if (group.length > 0) {
      groups[label] = group;
    }
  });
  return groups;
}

function columnLength(sort, label) {
  var res = 0;
  var cards = filteredCube();

  cards.forEach(function(card, cardindex) {
    if (cardIsLabel(card, label, sort)) {
      res += 1;
    }
  });
  return res;
}

function filteredCube() {
  if (filters.length == 0) {
    return cube;
  }

  var res = [];
  cube.forEach(function(card, index) {
    if (filterCard(card, filters)) {
      res.push(card);
    }
  });
  return res;
}

function setFilterQsargs() {
  var qsargsToSet = {},
    modifier;
  filters.forEach(function(filter, index) {
    if (!qsargsToSet[filter.category]) {
      qsargsToSet[filter.category] = "";
    }
    modifier = "+";
    if (filter.not) {
      modifier = "-";
    }
    qsargsToSet[filter.category] += modifier + filter.value + ",";
  });
  var newUrl = window.location.href.split('?')[0];
  if (!$.isEmptyObject(qsargsToSet)) {
    newUrl += "?" + $.param(qsargsToSet);
  }
  window.history.pushState({}, '', newUrl);
}

function buildFiltersFromQsargs() {
  var validCategories = getSorts(),
    qsargs = new URLSearchParams(window.location.search),
    qsargValues, value, valueIndex, qsargCategory;
  for (qsargCategory of qsargs.keys()) {
    if (!validCategories.includes(qsargCategory)) {
      continue;
    }
    qsargValues = qsargs.get(qsargCategory).split(",");
    for (valueIndex = 0; valueIndex < qsargValues.length; valueIndex++) {
      value = qsargValues[valueIndex];
      if (value.length > 0) {
        filters.push({
          category: qsargCategory,
          value: value.substring(1),
          not: value[0] === "-"
        });
      }
    }
  }
}

var updateCubeListeners = [];

function updateCubeList() {
  if (view == 'list') {
    $('#massEdit').text('Edit Selected');
  } else {
    $('#massEdit').text('Mass Edit');
  }
  for (let listener of updateCubeListeners) {
    listener(view, filteredCube());
  }
  switch (view) {
    case 'list':
      renderListView();
      break;
    case 'table':
    case 'curve':
    case 'spoiler':
      $('#cubelistarea').html('');
      break;
  }
  autocard_init('autocard');
  init_contextModal();
  if (canEdit) {
    init_groupcontextModal();
  }
  autocard_hide_card();
  setFilterQsargs();
}

function renderListView() {
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value;
  var columns = sortIntoGroups(filteredCube(), sorts[0]);
  Object.keys(columns).forEach(function(column_label, col_index) {
    columns[column_label] = sortIntoGroups(columns[column_label], sorts[1]);
  });

  var cards_all = [];
  var card_ids = [];
  Object.keys(columns).forEach(function(col, index) {
    Object.keys(columns[col]).forEach(function(rowgroup_label, rowgroup_index) {
      columns[col][rowgroup_label].forEach(function(card, index) {
        cards_all.push(card);
        card_ids.push(card.cardID);
      });
    });
  });
  var maxPos = Math.floor((cards_all.length - 1) / listGranularity);
  listPosition = Math.min(maxPos, Math.max(0, listPosition));
  var cards = cards_all.slice(listPosition * listGranularity, (listPosition + 1) * listGranularity);
  card_ids = card_ids.splice(listPosition * listGranularity, (listPosition + 1) * listGranularity);

  fetch("/cube/api/getversions", {
      method: "POST",
      body: JSON.stringify(card_ids),
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json())
    .then(function(json) {
      var versiondict = json.dict;

      var indexerHtml = '';
      if (maxPos > 0) {
        indexerHtml += '<hr>';
        indexerHtml += '<nav><ul class="pagination">';
        for (var j = 0; j <= maxPos; j++) {
          if (j == listPosition) {
            indexerHtml += '<li class="page-item active"><a href="#" data-id="' + j + '" class="listViewIndex page-link">' + (j + 1) + '<span class="sr-only">(current)</span></a></li>';
          } else {
            indexerHtml += '<li class="page-item"><a href="#" data-id="' + j + '" class="listViewIndex page-link">' + (j + 1) + '</a></li>';
          }
        }
        indexerHtml += '</ul></nav>';
      }

      res = indexerHtml;
      res += '<table class="table">';
      res += '<thead>';
      var headers = ["Name", "Version", "Type", "Status", "CMC", "Color", "Tags"];
      res += '<th scope="col"><input id="tdcheckall" type="checkbox" ></th>';
      headers.forEach(function(header, index) {
        res += '<th scope="col">' + header + '</th>';
      });
      res += '</thead>';
      for (i = 0; i < cards.length; i++) {
        res += '<tr class="listviewrow '
        if (show_tag_colors) {
          res += getCardTagColorClass(cards[i]);
        } else {
          res += getCardColorClass(cards[i]);
        }
        res += '">';

        //checkbox col
        if (cards[i].checked) {
          res += '<td class="nostretch"><input id="tdcheck' + cards[i].index + '" class="tdcheck" data-index="' + cards[i].index + '" type="checkbox" checked></td>';
        } else {
          res += '<td class="nostretch"><input id="tdcheck' + cards[i].index + '" class="tdcheck" data-index="' + cards[i].index + '" type="checkbox" ></td>';
        }

        //name col
        res += '<td id="namecol' + cards[i].index + '" data-index="' + cards[i].index + '" class="nostretch tdcard autocard" card="' + cards[i].details.display_image + '"><div data-index="' + cards[i].index + '" class="tdname"><a data-index="' + cards[i].index + '">' + cards[i].details.name + '</a></div></td>';

        //version col
        res += '<td data-index="' + cards[i].index + '" class="nostretch">';
        res += '<select class="compactControl form-control inputmd versionselect" data-index="' + cards[i].index + '">'
        versiondict[cards[i].cardID].forEach(function(version, index) {
          if (version.id == cards[i].cardID) {
            res += '<option cardid="' + version.id + '" selected>' + version.version + '</option>';
          } else {
            res += '<option cardid="' + version.id + '">' + version.version + '</option>';
          }
        });
        res += '</select>'
        res += '</td>';

        //type col
        res += '<td data-index="' + cards[i].index + '" class="nostretch">';
        res += '<input data-index="' + cards[i].index + '" class="compactControl form-control typeselect inputxl" value="' + cards[i].type_line + '">'
        res += '</td>';

        //status col
        res += '<td class="nostretch">';
        var labels = getLabels('Status');
        res += '<select data-index="' + cards[i].index + '" class="compactControl form-control statusselect inputl">'
        labels.forEach(function(label, index) {
          if (cards[i].status == label) {
            res += '<option selected>' + label + '</option>';
          } else {
            res += '<option>' + label + '</option>';
          }
        });
        res += '</select>'
        res += '</td>';

        //CMC col
        res += '<td data-index="' + cards[i].index + '" class="nostretch">';
        res += '<input data-index="' + cards[i].index + '" class="compactControl form-control cmcselect inputsm" value="' + cards[i].cmc + '">'
        res += '</td>';

        //color identiy col
        res += '<td data-index="' + cards[i].index + '" class="nostretch">';
        var labels = ['C', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG'];
        res += '<select data-index="' + cards[i].index + '" class="compactControl form-control colorselect inputmd">'
        labels.forEach(function(label, index) {
          if (label == 'C' && cards[i].colors.count == 0) {
            res += '<option selected>' + label + '</option>';
          } else {
            var match = true;
            cards[i].colors.forEach(function(color, index) {
              if (!label.includes(color.toUpperCase())) {
                match = false;
              }
            })
            if (match && label.length == cards[i].colors.length) {
              res += '<option selected>' + label + '</option>';
            } else {
              res += '<option>' + label + '</option>';
            }
          }
        });
        res += '</select>'
        res += '</td>';

        //tags col
        res += '<td data-index="' + cards[i].index + '" class="compactControl">';
        res += '<div class="tags-area" style="width:300px">';
        res += '<div class="tags-input" data-name="tags-input">';
        res += '<span class="tags">';
        var tagstext = '';
        cards[i].tags.forEach(function(tag, index) {
          if (index != 0) {
            tagstext += ', ';
          }
          tagstext += tag;
        });
        res += '</span>';
        res += '<input data-index="' + cards[i].index + '" class="hidden-input tagsselect" type="hidden" value="' + tagstext + '">';
        res += '<input class="main-input" maxLength="24">';
        res += '</div></div></td>';

        res += '</tr>';
      }
      res += '</table>'
      res += indexerHtml;
      res += '<hr>';

      $('#cubelistarea').html(res);
      autocard_init('autocard');
      activateTags();
      $('.tdcheck').change(function(e) {
        var index = $(this).attr('data-index');
        cube[index].checked = $(this).prop('checked');
      });
      $('#tdcheckall').change(function(e) {
        var checked = $(this).prop('checked');
        cards_all.forEach(function(card, index) {
          card.checked = checked;
          cube[card.index].checked = checked;
          $('#tdcheck' + card.index).prop('checked', checked);
        });
      });
      $('.tdcard').click(function(e) {
        var index = $(this).attr('data-index');
        if (cube[index].checked) {
          cube[index].checked = false;
        } else {
          cube[index].checked = true;
        }
        $('#tdcheck' + index).prop('checked', cube[index].checked);
      });
      $('.versionselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');
        var version = $(this).find('option:selected').attr('cardid');
        versiondict[cube[index].cardID].forEach(function(version, i) {
          if (version.version == val) {
            $('#namecol' + index).attr('card', version.img);
          }
        });
        versiondict[version] = versiondict[cube[index].cardID];
        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.cardID = version;

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.statusselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');

        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.status = val;

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.cmcselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');

        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.cmc = val;

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.typeselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');

        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.type_line = val.replace('-', '—');

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.colorselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');

        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.colors = [];
        for (var i = 0; i < val.length; i++) {
          updated.colors.push(val[i]);
        }

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.tagsselect').change(function(e) {
        var val = $(this).val();
        var index = $(this).attr('data-index');

        var updated = JSON.parse(JSON.stringify(cube[index]));
        delete updated.details;
        updated.tags = [];
        val.split(',').forEach(function(tag, index) {
          updated.tags.push(tag.trim());
        });

        let data = {
          src: cube[index],
          updated: updated,
        };
        fetch("/cube/api/updatecard/" + $('#cubeID').val(), {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => {
          fetch('/cube/api/getcardfromid/' + updated.cardID)
            .then(response => response.json())
            .then(function(json) {
              var card = cube[index];
              cube[index] = updated;
              cube[index].index = card.index;
              cube[index].details = json.card;
              cubeDict[cube[index].index] = cube[index];
            });
        });
      });
      $('.listViewIndex').click(function(e) {
        e.preventDefault();
        listPosition = $(this).attr('data-id');
        updateCubeList();
      });
    });
}

function updateFilters(filterText) {
  

  if (filterText) {
    new_filters = [];
    generateFilters(filterText.toLowerCase(), new_filters)
  } else {
    document.getElementById('filterarea').innerHTML = '<p><em>No active filters.</em></p>';
  }
}

let categoryMap = new Map([
  ['m', 'mana'],
  ['mana','mana'],
  ['cmc','cmc'],
  ['c','color'],
  ['color','color'],
  ['ci','identity'],
  ['id','identity'],
  ['identity','identity'],
  ['t','type'],
  ['type','type'],
  ['o','oracle'],
  ['oracle','oracle'],
  ['pow','power'],
  ['power','power'],
  ['tou', 'toughness'],
  ['toughness', 'toughness'],
  ['name', 'name']
]);

function findEndingQuotePosition(filterText, num) {
  if(!num) {
    num = 1;
  }
  for(let i = 1; i < filterText.length; i++) {
    if(filterText[i] == '(') num++;
    else if (filterText[i] == ')') num--;
    if (num === 0) { 
      return i;
    }
  }
  return false;
}

function tokenizeInput(filterText, tokens) {
  filterText = filterText.trim();
  if (!filterText) {
    return true;
  }

  const operators = '>=|<=|<|>|:|='
  //split string based on list of operators
  let operators_re = new RegExp('(?:' + operators + ')');

  if (filterText.indexOf('(') == 0) {
    if (findEndingQuotePosition(filterText, 0)) {
      let token = {
        type: 'open',
      }
      tokens.push(token);
      return tokenizeInput(filterText.slice(1), tokens);
    } else {
      return false;
    }
  }

  if (filterText.indexOf(')') == 0) {
    let token = {
      type: 'close'
    }
    tokens.push(token);
    return tokenizeInput(filterText.slice(1), tokens);
  }

  if (filterText.indexOf('or ') == 0 || (filterText.length == 2 && filterText.indexOf('or') == 0)) {
    tokens.push({type: 'or'});
    return tokenizeInput(filterText.slice(2), tokens);
  }

  if (filterText.indexOf('and ') == 0 || (filterText.length == 3 && filterText.indexOf('and') == 0)) {
    return tokenizeInput(filterText.slice(3), tokens);
  }

  let token = {
    type: 'token',
    not: false,
  };

  //find not
  if (filterText.indexOf('-') == 0) {
    token.not = true;
    filterText = filterText.slice(1);
  }

  let firstTerm = filterText.split(' ', 1);

  //find operand
  let operand = firstTerm[0].match(operators_re);
  if(operand) {
    operand = operand[0];
    token.operand = operand;
  } else {
    token.operand = 'none';
  }

  let quoteOp_re = new RegExp('(?:' + operators + ')"');
  let parens = false;

  //find category
  let category = '';
  if (token.operand == 'none') {
    category = 'name';
  } else {
    category = firstTerm[0].split(operators_re)[0];
  }

  //find arg value
  //if there are two quotes, and first char is quote
  if (filterText.indexOf('"') == 0 && filterText.split('"').length > 2) {
    //grab the quoted string, ignoring escaped quotes
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    //replace escaped quotes with plain quotes
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (firstTerm[0].search(quoteOp_re) > -1 && filterText.split('"').length > 2) {
    //check if there is a paren after an operator
    //TODO: make sure the closing paren isn't before the operator
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (token.operand != 'none'){
    token.arg = firstTerm[0].slice(category.length + token.operand.length).split(')')[0];
  } else {
    token.arg = firstTerm[0].split(')')[0];
  }


  filterText = filterText.slice((token.operand == 'none' ? (token.arg.length) : (token.arg.length + token.operand.length + category.length)) + (parens ? 2 : 0));

  if (!categoryMap.has(category)) {
    return false;
  }


  token.category = categoryMap.get(category);
  token.arg = simplifyArg(token.arg, token.category);
  if (token.operand && token.category && token.arg) {
    //replace any escaped quotes with normal quotes
    if (parens) token.arg = token.arg.replace(/\\"/g, '"');
    tokens.push(token);
    return tokenizeInput(filterText, tokens);
  } else { 
    return false;
  }

}

const colorMap = new Map([
  ['white', 'w'],
  ['blue', 'u'],
  ['black', 'b'],
  ['red', 'r'],
  ['green', 'g'],
  ['colorless', 'c'],
  ['azorius', 'uw'],
  ['dimir', 'ub'],
  ['rakdos', 'rb'],
  ['gruul', 'rg'],
  ['selesnya', 'gw'],
  ['orzhov', 'bw'],
  ['izzet', 'ur'],
  ['golgari', 'gb'],
  ['boros', 'wr'],
  ['simic', 'ug'],
  ['bant', 'gwu'],
  ['esper', 'wub'],
  ['grixis', 'ubr'],
  ['jund', 'brg'],
  ['naya', 'rgw'],
  ['abzan', 'wbg'],
  ['jeskai', 'urw'],
  ['sultai', 'bgu'],
  ['mardu', 'rwb'],
  ['temur', 'rug']
]);

//change arguments into their verifiable counteraprts, i.e. 'azorius' becomes 'uw'
function simplifyArg(arg, category) {
  let res = '';
  switch (category) {
    case 'color':
    case 'identity':
      if(colorMap.has(arg)){
        res = colorMap.get(arg);
      } else {
        res = arg;
      }
      res = res.split('').map( (element) => element.toUpperCase());
      break;
    case 'mana':
      res = parseManaCost(arg)
      break;
    default:
      res = arg;
      break;
  }
  return res;
}

//converts filter scryfall syntax string to global filter objects
//returns true if decoding was successful, and filter object is populated, or false otherwise
function generateFilters(filterText) {
  let tokens = [];
  
  if (tokenizeInput(filterText, tokens)) {
    if (verifyTokens(tokens)) {
      filters = [parseTokens(tokens)];
      //TODO: generate a filter string, and return better errors to user
      document.getElementById('filterarea').innerHTML = '<p><em>Filter Applied.</em></p>';
      updateCubeList();
    } else {
      document.getElementById('filterarea').innerHTML = '<p><em>Invalid Filter String.</em></p>';
    }
  } else {
    document.getElementById('filterarea').innerHTML = '<p><em>Invalid Filter String.</em></p>';
  }
}

const verifyTokens = (tokens) => {
  let temp = tokens;
  let inBounds = (num) => {
    return num > -1 && num < temp.length;
  }
  let type = (i) => temp[i].type;
  let token = (i) => temp[i];

  for (let i = 0; i < temp.length; i++) {
    if (type(i) == 'open') {
      let closed = findClose(temp, i);
      if (!closed) return false;
      temp[closed].valid = true;
    }
    if (type(i) == 'close') {
      if(!temp[i].valid) return false;
    }
    if (type(i) == 'or') {
      if (!inBounds(i - 1) || !inBounds(i + 1)) return false;
      if (!(type(i - 1) == 'close' || type(i - 1) == 'token')) return false;
      if (!(type(i + 1) != 'open' || type(i + 1) != 'token')) return false;
    }
    if (type(i) == 'token') {
      switch(token(i).category) {
        case 'color':
        case 'identity':
          let verifyColors = (element) => {
            return element.search(/^[WUBRGC]$/) < 0;
          }
          if (token(i).arg.every(verifyColors)) {
            return false;
          }
          break;
        case 'cmc':
        case 'power':
        case 'toughness':
          if(token(i).arg.search(/^\d+$/) < 0) return false;
          break;
        case 'mana':
          let verifyMana = (element) => {
            element.search(/^(\d+|[wubrgscxyz]|{([wubrg2]\-[wubrg]|[wubrg]\-p)})$/) < 0;
          }
          if (token(i).arg.every(verifyMana)) {
            return false;
          }
          break;
      }
    }

  }
  return true;
}

const hybridMap = new Map([
  ['u-w', 'w-u'],
  ['b-w', 'w-b'],
  ['b-u', 'u-b'],
  ['r-u', 'u-r'],
  ['r-b', 'b-r'],
  ['g-b', 'b-g'],
  ['g-r', 'r-g'],
  ['w-r', 'r-w'],
  ['w-g', 'g-w'],
  ['u-g', 'g-u']
]);

function parseManaCost (cost) {
  let res = [];
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] == '{') {
      let str = cost.slice(i+1, i+4).toLowerCase();
      if (str.search(/[wubrg]\/p/) > -1) {
        res.push(cost[i+1] + '-p');
        i = i+4;
      } else if (str.search(/2\/[wubrg]/) > -1) {
        res.push('2-' + cost[i+3]);
        i = i+4;
      } else if (str.search(/[wubrg]\/[wubrg]/) > -1) {
        let symbol = cost[i+1] + '-' + cost[i+3];
        if (hybridMap.has(symbol)) {
          symbol = hybridMap.get(symbol);
        }
        res.push(symbol);
        i = i+4;
      } else if (str.search(/^[wubrgscxyz]}/) > -1 ) {
        res.push(cost[i+1]);
        i = i+2;
      } else if (str.search(/^[0-9]+}/) > -1) {
        let num = str.match(/[0-9]+/)[0];
        if (num.length <= 2) {
          res.push(num);
        }
        i = i + num.length + 1;
      }
    } else if (cost[i].search(/[wubrgscxyz]/) > -1) {
      res.push(cost[i]);
    } else if (cost[i].search(/[0-9]/) > -1) {
      let num = cost.slice(i).match(/[0-9]+/)[0];
      if (num.length <= 2) {
        res.push(num);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return res;
}

const findClose = (tokens, pos) => {
  if(!pos) pos = 0;
  let num = 1;
  for(let i = pos+1; i < tokens.length; i++) {
    if(tokens[i].type == 'close') num--;
    else if (tokens[i].type == 'open') num++;
    if (num === 0) { 
      return i;
    }
  }
  return false;
}

const parseTokens = (tokens) => {
  let peek = () => tokens[0];
  let consume = peek;

  let result = [];
  if (peek().type == 'or') {
    return parseTokens(tokens.slice(1));
  }
  if (peek().type == 'open') {
    let end = findClose(tokens);
    if(end < tokens.length - 1 && tokens[end + 1].type == 'or') result.type = 'or';
    result.push(parseTokens(tokens.slice(1, end)));
    if(tokens.length > end + 1) result.push(parseTokens(tokens.slice(end+1)));
    return result;
  } else if (peek().type == 'token') {
    if (tokens.length == 1) {
      return consume();
    } else {
      if(tokens[1].type == 'or') result.type = 'or';
      result.push(consume());
      result.push(parseTokens(tokens.slice(1)));
      return result;
    }
  }
}

function buildFilterArea() {
  //TODO: grab filters from url arg
  updateFilters();
}

function addSorts() {
  sort_categories = getSorts();
  var sorthtml = "";
  sort_categories.forEach(function(category, index) {
    sorthtml += sortItemTemplate.replace('#{value}', category).replace('#{label}', category);
  });

  //document.getElementById('filterType').innerHTML = sorthtml;
  sorthtml += sortItemTemplate.replace('#{value}', 'Unsorted').replace('#{label}', 'Unsorted');
  document.getElementById('secondarySortSelect').innerHTML = sorthtml;
  document.getElementById('primarySortSelect').innerHTML = sorthtml;
  if (document.getElementById("sort1").value.length > 0 && document.getElementById("sort2").value.length > 0) {
    document.getElementById('primarySortSelect').selectedIndex = sort_categories.indexOf(document.getElementById("sort1").value);
    document.getElementById('secondarySortSelect').selectedIndex = sort_categories.indexOf(document.getElementById("sort2").value);
  } else {
     document.getElementById('primarySortSelect').selectedIndex = sort_categories.indexOf('Color Category');
     document.getElementById('secondarySortSelect').selectedIndex = sort_categories.indexOf('Types-Multicolor');
  }
}

var prev_handler = window.onload;
window.onload = function() {
  if (prev_handler) {
    prev_handler();
  }
  //buildFiltersFromQsargs();
  buildFilterArea();
  addSorts();
  updateCubeList();
  activateTags();
};
