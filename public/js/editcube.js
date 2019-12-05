var canEdit = $('#edittoken').val();
var changes = [];

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

function csrfFetch(resource, init) {
  init.credentials = init.credentials || 'same-origin';
  init.headers = Object.assign(init.headers, {
    'CSRF-Token': getCsrfToken(),
  });
  return fetch(resource, init);
}

let comparing = false;
if ($('#in_both').length) {
  comparing = true;
  const in_both = JSON.parse($('#in_both').val());
  const only_a = JSON.parse($('#only_a').val());
  const only_b = JSON.parse($('#only_b').val());
  view = 'table';
}

const cubeDict = {};
let hasCustomImages = false;
$('#customImageDisplayMenuItem').hide();
const cube = JSON.parse($('#cuberaw').val());
cube.forEach(function(card, index) {
  card.index = index;
  cubeDict[index] = card;
  if (!hasCustomImages && card.imgUrl !== undefined) {
    hasCustomImages = true;
    $('#customImageDisplayToggle').prop('checked', true);
    $('#customImageDisplayMenuItem').show();
  }
});

$('#customImageDisplayToggle').click(function(e) {
  const enabled = $(this).prop('checked');
  let display_image;
  cube.forEach(function(card, index) {
    adjustDisplayImage(card, enabled);
  });
  updateCubeList();
});

const editListeners = [];

if (canEdit) {
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
}

function justAdd() {
  let val = $('#addInput')
    .val()
    .replace('?', '-q-');
  while (val.includes('//')) {
    val = val.replace('//', '-slash-');
  }
  if (val.length > 0) {
    fetch(`/cube/api/getcard/${val}`)
      .then((response) => response.json())
      .then(function(json) {
        if (json.card) {
          $('#addInput').val('');
          changes.push({
            add: json.card,
          });
          updateCollapse();
          $('.warnings').collapse('hide');
        } else {
          $('.warnings').collapse('show');
        }
      });
  }
}

function remove() {
  let val = $('#removeInput')
    .val()
    .replace('?', '-q-');
  while (val.includes('//')) {
    val = val.replace('//', '-slash-');
  }
  if (val.length > 0) {
    fetch(`/cube/api/getcardfromcube/${$('#cubeID').val()};${val}`)
      .then((response) => response.json())
      .then(function(json) {
        if (json.card) {
          if ($('#addInput').val().length > 0) {
            let val2 = $('#addInput')
              .val()
              .replace('?', '-q-');
            while (val2.includes('//')) {
              val2 = val2.replace('//', '-slash-');
            }
            fetch(`/cube/api/getcard/${val2}`)
              .then((response2) => response2.json())
              .then(function(json2) {
                if (json2.card) {
                  $('#addInput').val('');
                  $('#removeInput').val('');
                  changes.push({
                    replace: [json.card, json2.card],
                  });
                  updateCollapse();
                  $('.warnings').collapse('hide');
                } else {
                  $('.warnings').collapse('show');
                }
              });
          } else {
            $('#removeInput').val('');
            changes.push({
              remove: json.card,
            });
            updateCollapse();
            $('.warnings').collapse('hide');
          }
        } else {
          $('.warnings').collapse('show');
        }
      });
  }
}

function updateCollapse() {
  let val = '';
  changes.forEach(function(change, index) {
    val += `<a class='clickx' id='clickx${index}' href=#>x</a> `;
    if (change.add) {
      val += '<span class="badge badge-success">+</span> ';
      if (change.add.image_flip) {
        val += `<a class="dynamic-autocard" card="${change.add.image_normal}" card_flip="${change.add.image_flip}">${change.add.name}</a>`;
      } else {
        val += `<a class="dynamic-autocard" card="${change.add.image_normal}">${change.add.name}</a>`;
      }
    } else if (change.remove) {
      val += '<span class="badge badge-danger">–</span> ';
      if (change.remove.image_flip) {
        val += `<a class="dynamic-autocard" card="${change.remove.image_normal}" card_flip="${change.remove.image_flip}">${change.remove.name}</a>`;
      } else {
        val += `<a class="dynamic-autocard" card="${change.remove.image_normal}">${change.remove.name}</a>`;
      }
    } else if (change.replace) {
      val += '<span class="badge badge-primary">→</span> ';
      if (change.replace[0].image_flip) {
        val += `<a class="dynamic-autocard" card="${change.replace[0].image_normal}" card_flip="${change.replace[0].image_flip}">${change.replace[0].name}</a> > `;
      } else {
        val += `<a class="dynamic-autocard" card="${change.replace[0].image_normal}">${change.replace[0].name}</a> > `;
      }
      if (change.replace[1].image_flip) {
        val += `<a class="dynamic-autocard" card="${change.replace[1].image_normal}" card_flip="${change.replace[1].image_flip}">${change.replace[1].name}</a>`;
      } else {
        val += `<a class="dynamic-autocard" card="${change.replace[1].image_normal}">${change.replace[1].name}</a>`;
      }
    }
    val += '<br>';
  });

  $('#changelist').html(val);

  if (val.length > 0) {
    $('.editForm').collapse('show');
  } else {
    $('.editForm').collapse('hide');
  }

  autocard_init('dynamic-autocard');
  changes.forEach(function(change, index) {
    const clickx = document.getElementById(`clickx${index}`);
    clickx.addEventListener('click', function(e) {
      changes.splice(index, 1);
      updateCollapse();
    });
  });
}

function GetColorIdentity(colors) {
  if (colors.length == 0) {
    return 'Colorless';
  }
  if (colors.length > 1) {
    return 'Multicolored';
  }
  if (colors.length == 1) {
    switch (colors[0]) {
      case 'W':
        return 'White';
        break;
      case 'U':
        return 'Blue';
        break;
      case 'B':
        return 'Black';
        break;
      case 'R':
        return 'Red';
        break;
      case 'G':
        return 'Green';
        break;
      case 'C':
        return 'Colorless';
        break;
    }
  }
}

function getSorts() {
  return [
    'Artist',
    'CMC',
    'Color Category',
    'Color Count',
    'Color Identity',
    'Color',
    'Date Added',
    'Guilds',
    'Legality',
    'Loyalty',
    'Manacost Type',
    'Power',
    'Price',
    'Price Foil',
    'Rarity',
    'Set',
    'Shards / Wedges',
    'Status',
    'Subtype',
    'Supertype',
    'Tags',
    'Toughness',
    'Type',
    'Types-Multicolor',
    'Unsorted',
  ];
}

function getLabels(sort) {
  if (sort == 'Color Category') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless', 'Lands'];
  }
  if (sort == 'Color Identity') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  }
  if (sort == 'CMC') {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
  }
  if (sort == 'CMC2') {
    return ['0-1', '2', '3', '4', '5', '6', '7+'];
  }
  if (sort == 'CMC-Full') {
    // All CMCs from 0-16, with halves included, plus Gleemax at 1,000,000.
    return Array.from(Array(33).keys())
      .map((x) => (x / 2).toString())
      .concat(['1000000']);
  }
  if (sort == 'Color') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
  }
  if (sort == 'Type') {
    return [
      'Creature',
      'Planeswalker',
      'Instant',
      'Sorcery',
      'Artifact',
      'Enchantment',
      'Conspiracy',
      'Contraption',
      'Phenomenon',
      'Plane',
      'Scheme',
      'Vanguard',
      'Land',
      'Other',
    ];
  }
  if (sort == 'Supertype') {
    return ['Snow', 'Legendary', 'Tribal', 'Basic', 'Elite', 'Host', 'Ongoing', 'World'];
  }
  if (sort == 'Tags') {
    var tags = [];
    cube.forEach(function(card, index) {
      card.tags.forEach(function(tag, index2) {
        if (tag.length > 0 && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });
    return tags.sort();
  }
  if (sort == 'Date Added') {
    var days = [],
      formattedDay;
    cube.forEach(function(card, index) {
      formattedDay = ISODateToYYYYMMDD(card.addedTmsp);
      if (formattedDay === undefined) {
        formattedDay = 'unknown';
      }
      if (!days.includes(formattedDay)) {
        days.push(formattedDay);
      }
    });
    return days.sort();
  }
  if (sort == 'Status') {
    return ['Not Owned', 'Ordered', 'Owned', 'Premium Owned'];
  }
  if (sort === 'Finish') {
    return ['Non-foil', 'Foil'];
  }
  if (sort == 'Guilds') {
    return ['Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Golgari', 'Simic', 'Izzet', 'Boros'];
  }
  if (sort == 'Shards / Wedges') {
    return ['Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Abzan', 'Jeskai', 'Sultai', 'Mardu', 'Temur'];
  }
  if (sort == 'Color Count') {
    return ['0', '1', '2', '3', '4', '5'];
  }
  if (sort == 'Set') {
    var sets = [];
    cube.forEach(function(card, index) {
      if (!sets.includes(card.details.set.toUpperCase())) {
        sets.push(card.details.set.toUpperCase());
      }
    });
    return sets.sort();
  }
  if (sort == 'Artist') {
    var artists = [];
    cube.forEach(function(card, index) {
      if (!artists.includes(card.details.artist)) {
        artists.push(card.details.artist);
      }
    });
    return artists.sort();
  }
  if (sort == 'Rarity') {
    return ['Common', 'Uncommon', 'Rare', 'Mythic'];
  }
  if (sort == 'Unsorted') {
    return ['All'];
  }
  if (sort == 'Subtype') {
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
  }
  if (sort == 'Types-Multicolor') {
    return [
      'Creature',
      'Planeswalker',
      'Instant',
      'Sorcery',
      'Artifact',
      'Enchantment',
      'Conspiracy',
      'Contraption',
      'Phenomenon',
      'Plane',
      'Scheme',
      'Vanguard',
      'Azorius',
      'Dimir',
      'Rakdos',
      'Gruul',
      'Selesnya',
      'Orzhov',
      'Golgari',
      'Simic',
      'Izzet',
      'Boros',
      'Bant',
      'Esper',
      'Grixis',
      'Jund',
      'Naya',
      'Abzan',
      'Jeskai',
      'Sultai',
      'Mardu',
      'Temur',
      'Non-White',
      'Non-Blue',
      'Non-Black',
      'Non-Red',
      'Non-Green',
      'Five Color',
      'Land',
      'Other',
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
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
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
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
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
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
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
    labels.push('No Price Available');
    return labels;
  } else if (sort == 'Unsorted') {
    return ['All'];
  }
}

function sortIntoGroups(cards, sort) {
  const groups = {};
  const labels = getLabels(sort);
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
  let res = 0;
  const cards = filteredCube();

  cards.forEach(function(card, cardindex) {
    if (cardIsLabel(card, label, sort)) {
      res += 1;
    }
  });
  return res;
}

const updateCubeListeners = [];

function updateCubeList() {
  updateCubeListeners.forEach((listener) => listener(cube));
  autocard_init('autocard');
  autocard_hide_card();
}

const prev_handler = window.onload;
window.onload = function() {
  if (prev_handler) {
    prev_handler();
  }
  updateCubeList();
};
