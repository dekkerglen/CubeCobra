var filterTemplate = '<div class="input-group mb-3 filter-item" data-index="#{index}"><div class="input-group-prepend"><span class="input-group-text">#{filterName}</span></div>'+
                     '<select class="custom-select" id="#{filterID}" data-index="#{filterindex}" aria-label="Example select with button addon">' +
                     '#{items}</select><div class="input-group-append"><div class="input-group-text"><input type="checkbox" data-index="#{checkboxindex}" id="#{checkbox}"/><a style="padding-left: 5px">Not </a></div>' +
                     '<button class="btn btn-outline-secondary filter-button" data-index="#{buttonindex}" type="button">Remove</button></div></div>';
var filterItemTemplate = '<option value="#{value}">#{label}</option>';
var canEdit = $('#edittoken').val();
var listGranularity = 100;
var changes = [];
var sorts = [];
var filters = [];
var groupSelect = null;
var modalSelect = null;
var view = $('#viewSelect').val();

var cubeDict = {};
var cube = JSON.parse($('#cuberaw').val());
cube.forEach(function(card, index)
{
  card.index = index;
  cubeDict[index] = card;
});

$('#addFilterButton').click(function(e)
{
  var filterType = $('#filterType').val();
  filters.push({
    category: filterType,
    value: getLabels(filterType)[0],
    not:false
  });
  updateFilters();
});

$('.updateButton').click(function(e)
{
  updateCubeList();
});

$('#viewSelect').change(function(e)
{
  view = $('#viewSelect').val();
  updateCubeList();
});

if(canEdit) {
  tags_autocomplete($('#contextModalTagsMainInput')[0], $('#contextModalTagsHiddenInput')[0], updateTags);
  tags_autocomplete($('#groupContextModalTagsMainInput')[0], $('#groupContextModalTagsHiddenInput')[0], updateGroupTags);

  $('#justAddButton').click(function(e) {
    justAdd()
  });
  $('#removeButton').click(function(e) {
    remove();
  });
  $('#saveChangesButton').click(function(e) {
    $('#changelistBlog').val($('#editor').html());
    var val = $('changelistFormBody').val();
    if(!val)
    {
      val = '';
    }
    changes.forEach(function(change, index)
    {
      if(index != 0)
      {
        val += ';';
      }
      if(change.add)
      {
        val += '+' + change.add._id;
      }
      else if(change.remove)
      {
        val += '-' + change.remove._id;
      }
      else if(change.replace)
      {
        val += '/' + change.replace[0]._id + '>';
        val += change.replace[1]._id;
      }
    });
    $('#changelistFormBody').val(val);
    console.log(val);
    document.getElementById("changelistForm").submit();
  });
  $('#discardAllButton').click(function(e)
  {
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
    fetch('/cube/api/getcardfromid/'+e.target.value)
      .then(response => response.json())
      .then(function(json)
    {
      $('#contextModalImg').attr('src',json.card.image_normal);
    });
  });
  $('#groupContextModalSubmit').click(function(e) {
    //if we typed a tag but didn't hit enter, register that tag
    if($('#groupContextModalTagsMainInput').val().length > 0)
    {
      var tag = $('#groupContextModalTagsMainInput').val();
      $('#groupContextModalTagsMainInput').val('');

      var val = $('#groupContextModalTagsHiddenInput').val();

      if(val.length > 0)
      {
        val += ', ' + tag;
      }
      else
      {
        val = tag;
      }
      $('#groupContextModalTagsHiddenInput').val(val);
      updateGroupTags();
    }
    updated = {
      addTags:$('#groupContextAdd').prop('checked')
    };

    tags_split = $('#groupContextModalTagsHiddenInput').val().split(',');
    tags_split.forEach(function(tag, index)
    {
      tags_split[index] = tags_split[index].trim();
    });
    updated.tags = tags_split;

    var val = $('#groupContextModalStatusSelect').val();
    if(val.length > 0)
    {
      updated.status = val;
    }

    var filterobj = null;
    if(filters.length > 0)
    {
      filterobj = getFilterObj();
    }
    let data =
    {
      sorts:sorts,
      filters:filterobj,
      categories:groupContextModal.categories,
      updated:updated,
      token:$('#edittoken').val()
    };

    fetch("/cube/api/updatecards/"+$('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    }).then(res => {
      cube.forEach(function(card, index)
      {
        if(cardIsLabel(card,data.categories[0],sorts[0]) && cardIsLabel(card,data.categories[1],sorts[1]))
        {
          if(updated.status)
          {
            cube[index].status = updated.status;
          }
          if(updated.tags)
          {
            if(updated.addTags)
            {
              updated.tags.forEach(function(newtag, tag_ind)
              {
                if(!cube[index].tags.includes(newtag))
                {
                  cube[index].tags.push(newtag);
                }
              });
            }
            else
            {
              //remove the tags
              updated.tags.forEach(function(tag, tag_in)
              {
                var temp = cube[index].tags.indexOf(tag);
                if (temp > -1) {
                   cube[index].tags.splice(temp, 1);
                }
              });
            }
          }
        }
      });

      updateCubeList();
      $('#groupContextModal').modal('hide');
    });
  });
  $('#contextModalTagsArea').click(function(e)
  {
    $('#groupContextModalTagsMainInput').focus();
  });
  $('#groupContextModalTagsArea').click(function(e) {
    $('#groupContextModalTagsMainInput').focus();
  });
  $('#groupContextRemoveButton').click(function(e) {
    groupSelect.forEach(function(card, index)
    {
      changes.push({remove:card.details})
    });
    updateCollapse();
    $('#groupContextModal').modal('hide');
    $('#navedit').collapse("show");
    $('.warnings').collapse("hide");
  });
  $('#contextRemoveButton').click(function(e)
  {
    changes.push({remove:modalSelect.details})
    updateCollapse();
    $('#contextModal').modal('hide');
    $('#navedit').collapse("show");
    $('.warnings').collapse("hide");
  });
  $('#contextModalSubmit').click(function(e)
  {
    //if we typed a tag but didn't hit enter, register that tag
    if($('#groupContextModalTagsMainInput').val().length > 0)
    {
      var tag = $('#groupContextModalTagsMainInput').val();
      $('#groupContextModalTagsMainInput').val('');

      var val = $('#contextModalTagsHiddenInput').val();
      if(val.length > 0)
      {
        val += ', ' + tag;
      }
      else
      {
        val = tag;
      }
      $('#contextModalTagsHiddenInput').val(val);
      updateTags();
    }

    updated = {};

    tags_split = $('#contextModalTagsHiddenInput').val().split(',');
    tags_split.forEach(function(tag, index)
    {
      tags_split[index] = tags_split[index].trim();
    });
    updated.tags = tags_split;
    updated.colors = [];

    ['W','U','B','R','G'].forEach(function(color, index)
    {
      if($('#contextModalCheckbox'+color).prop('checked'))
      {
        updated.colors.push(color);
      }
    });

    updated.status = $('#contextModalStatusSelect').val();
    updated.cardID = $('#contextModalVersionSelect').val();
    updated.cmc = $('#contextModalTagsCMC').val();

    let data =
    {
      src:modalSelect,
      updated:updated,
      token:document.getElementById("edittoken").value
    };
    fetch("/cube/api/updatecard/"+$('#cubeID').val(), {
      method: "POST",
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    }).then(res => {
      fetch('/cube/api/getcardfromid/'+updated.cardID)
        .then(response => response.json())
        .then(function(json)
      {
        var found = false;
        cube.forEach(function(card, index)
        {
          if(!found && card.index==data.src.index)
          {
            found = true;
            cube[index] = updated;
            cube[index].index = card.index;
            cube[index].details = json.card;
            cubeDict[cube[index].index] = cube[index];
          }
        });

        updateCubeList();
        $('#contextModal').modal('hide');
      });
    });
  });
  $('#saveSortButton').click(function(e)
  {
    var temp_sorts = [];
    temp_sorts[0] = document.getElementById('primarySortSelect').value;
    temp_sorts[1] = document.getElementById('secondarySortSelect').value;
    let data =
    {
      sorts:temp_sorts,
      token:document.getElementById("edittoken").value
    };
    fetch("/cube/api/savesorts/"+$('#cubeID').val(),
    {
      method: "POST",
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    }).then(res => {
        $('#cubeSaveModal').modal('show');
    });
  });
}

function updateTags() {
  var tagsText = "";
  $('#contextModalTagsHiddenInput').val().split(',').forEach(function(tag, index)
  {
    if(tag.trim() != "")
    {
      tagsText += "<span class='tag'>"+tag.trim()+"<span tag-data='"+tag.trim()+"' class='close-tag'></span></span>";
    }
  });
  $('#contextModalTagsDiv').html(tagsText);

  if(canEdit)
  {
    $('.close-tag').click(function(e)
    {
      newtags = $('#contextModalTagsHiddenInput').val().split(',').filter(function(element) { return element.trim() !== e.target.getAttribute('tag-data')});
      var tagsText = "";
      newtags.forEach(function(tag, index)
      {
        if(index != 0)
        {
           tagsText += ', ';
        }
        tagsText += tag;
      });
      $('#contextModalTagsHiddenInput').val(tagsText);
      updateTags();
    });
  }
}

function updateGroupTags() {
  var tagsText = "";
  $('#groupContextModalTagsHiddenInput').val().split(',').forEach(function(tag, index)
  {
    if(tag.trim() != "")
    {
      tagsText += "<span class='tag'>"+tag.trim()+"<span tag-data='"+tag.trim()+"' class='close-tag'></span></span>";
    }
  });
  $('#groupContextModalTagsDiv').html(tagsText);

  if(canEdit)
  {
    $('.close-tag').click(function(e)
    {
      newtags = $('#groupContextModalTagsHiddenInput').val().split(',').filter(function(element) { return element.trim() !== e.target.getAttribute('tag-data')});
      var tagsText = "";
      newtags.forEach(function(tag, index)
      {
        if(index != 0)
        {
           tagsText += ', ';
        }
        tagsText += tag;
      });
      $('#groupContextModalTagsHiddenInput').val(tagsText);
      updateGroupTags();
    });
  }
}

function tags_autocomplete(inp, hidden, updatefn) {
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", function(e)
  {
    var a, b, i, val = this.value;
    /*close any already open lists of autocompleted values*/
    closeAllLists();
    if (!val) { return false;}
    currentFocus = -1;
    /*create a DIV element that will contain the items (values):*/
    a = document.createElement("DIV");
    a.setAttribute("id", this.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-modal-items");
    /*append the DIV element as a child of the autocomplete container:*/
    this.parentNode.parentNode.appendChild(a);
    /*for each item in the array...*/
    matches = getLabels('Tags');
    for (i = 0; i < matches.length; i++)
    {
      if (matches[i].substr(0, val.length).toUpperCase() == val.toUpperCase())
      {
        /*check if the item starts with the same letters as the text field value:*/
        /*create a DIV element for each matching element:*/
        b = document.createElement("DIV");
        /*make the matching letters bold:*/
        b.innerHTML = "<strong>" + matches[i].substr(0, val.length) + "</strong>";
        b.innerHTML += matches[i].substr(val.length);
        /*insert a input field that will hold the current array item's value:*/
        b.innerHTML += "<input type='hidden' value='" + matches[i].replace("'","%27") + "'>";
        /*execute a function when someone clicks on the item value (DIV element):*/
        b.addEventListener("click", function(e)
        {
          inp.value = this.getElementsByTagName("input")[0].value.replace("%27","'");
          closeAllLists();
          submitTag();
        });
        a.appendChild(b);
      }
    }
  });
  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + "autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
        increase the currentFocus variable:*/
        currentFocus++;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 38) { //up
        /*If the arrow UP key is pressed,
        decrease the currentFocus variable:*/
        currentFocus--;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 9) {
        /*If the tab key is pressed, prevent the form from being submitted,*/
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          e.preventDefault();
          if (x)
          {
             x[currentFocus].click();
          }
        }
        else
        {
          submitTag();
        }
      }else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x)
          {
             x[currentFocus].click();
          }
        }
        else
        {
          submitTag();
        }
      }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-modal-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
      closeAllLists(e.target);
  });
  function submitTag()
  {
    var tag = inp.value;
    if(tag.length > 0)
    {
      inp.value = "";

      if(hidden.value.length > 0)
      {
        hidden.value += ', ' + tag;
      }
      else
      {
        hidden.value = tag;
      }
      updatefn();
    }
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

function justAdd() {
  var val = $('#addInput').val().replace('//','-slash-').replace('?','-q-');
  if(val.length > 0)
  {
    fetch('/cube/api/getcard/'+val)
      .then(response => response.json())
      .then(function(json)
    {
      if(json.card)
      {
        $('#addInput').val('');
        changes.push({add:json.card})
        updateCollapse();
        $('.warnings').collapse("hide");
      }
      else
      {
        $('.warnings').collapse("show");
      }
    });
  }
}

function remove() {
  var val = $('#removeInput').val().replace('//','-slash-').replace('?','-q-');
  if(val.length > 0)
  {
    fetch('/cube/api/getcardfromcube/'+$('#cubeID').val()+';'+val)
      .then(response => response.json())
      .then(function(json)
    {
      if(json.card)
      {
        if($('#addInput').val().length > 0)
        {
          var val2 = $('#addInput').val().replace('//','-slash-').replace('?','-q-');
          fetch('/cube/api/getcard/'+val2)
            .then(response2 => response2.json())
            .then(function(json2)
          {
            if(json2.card)
            {
              $('#addInput').val('');
              $('#removeInput').val('');
              changes.push({replace:[json.card,json2.card]})
              updateCollapse();
              $('.warnings').collapse("hide");
            }
            else
            {
              $('.warnings').collapse("show");
            }
          });
        }
        else
        {
          $('#removeInput').val('');
          changes.push({remove:json.card})
          updateCollapse();
          $('.warnings').collapse("hide");
        }
      }
      else
      {
        $('.warnings').collapse("show");
      }
    });
  }
}

function updateCollapse() {
  var val = "";
  changes.forEach(function(change, index)
  {
    val += "<a style='color:red;font-weight: bold;text-decoration: underline;' id='clickx" + index+ "' href=#>x</a> ";
    if(change.add)
    {
      val += '<span class="badge badge-success">+</span> ';
      if(change.add.image_flip)
      {
        val += '<a class="dynamic-autocard" card="'+ change.add.image_normal + '" card_flip="'+ change.add.image_flip + '">' + change.add.name + '</a>';
      }
      else
      {
        val += '<a class="dynamic-autocard" card="'+ change.add.image_normal + '">' + change.add.name + '</a>';
      }
    }
    else if(change.remove)
    {
      val += '<span class="badge badge-danger">–</span> ';
      if(change.remove.image_flip)
      {
        val += '<a class="dynamic-autocard" card="'+ change.remove.image_normal + '" card_flip="'+ change.remove.image_flip + '">' + change.remove.name + '</a>';
      }
      else
      {
        val += '<a class="dynamic-autocard" card="'+ change.remove.image_normal + '">' + change.remove.name + '</a>';
      }
    }
    else if(change.replace)
    {
      val += '<span class="badge badge-primary">→</span> ';
      if(change.replace[0].image_flip)
      {
        val += '<a class="dynamic-autocard" card="'+ change.replace[0].image_normal + '" card_flip="'+ change.replace[0].image_flip + '">' + change.replace[0].name + '</a> > ';
      }
      else
      {
        val += '<a class="dynamic-autocard" card="'+ change.replace[0].image_normal + '">' + change.replace[0].name + '</a> > ';
      }
      if(change.replace[1].image_flip)
      {
        val += '<a class="dynamic-autocard" card="'+ change.replace[1].image_normal + '" card_flip="'+ change.replace[1].image_flip + '">' + change.replace[1].name + '</a>';
      }
      else
      {
        val += '<a class="dynamic-autocard" card="'+ change.replace[1].image_normal + '">' + change.replace[1].name + '</a>';
      }
    }
    val += "<br>"
  });

  $('#changelist').html(val);

  if($('#changelist').html().length > 0)
  {
    $('.editForm').collapse("show");
  }
  else {
    $('.editForm').collapse("hide")
  }

  autocard_init_class('dynamic-autocard');
  changes.forEach(function(change, index)
  {
    var clickx = document.getElementById("clickx"+index);
    clickx.addEventListener("click", function(e)
    {
      changes.splice(index,1);
      updateCollapse();
    });
  });
}

function GetColorIdentity(colors) {
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

function getSorts() {
  return ['Color','Color Identity','Color Category','CMC','Type','Supertype','Subtype','Tags','Status','Guilds','Shards / Wedges','Color Count','Set','Rarity','Types-Multicolor','Artist','Legality','Power','Toughness','Loyalty','Manacost Type'];
}

function getLabels(sort) {
  if(sort == 'Color Category')
  {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless','Lands'];
  }
  else if(sort == 'Color Identity')
  {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  }
  else if(sort == 'CMC')
  {
    return ['0','1','2','3','4','5','6','7','8+'];
  }
  else if(sort == 'CMC2')
  {
    return ['0-1','2','3','4','5','6','7+'];
  }
  else if(sort == 'Color')
  {
    return ['White','Blue','Black','Red','Green','Colorless'];
  }
  else if (sort == 'Type')
  {
    return ['Creature','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Land','Conspiracy','Scheme','Vanguard','Phenomenon','Contraption','Plane'];
  }
  else if (sort == 'Supertype')
  {
    return ['Snow','Legendary','Tribal','Basic','Elite','Host','Ongoing','World'];
  }
  else if (sort == 'Tags')
  {
    var tags = [];
    cube.forEach(function(card, index)
    {
      card.tags.forEach(function(tag, index2)
      {
        if(tag.length > 0 && !tags.includes(tag))
        {
          tags.push(tag);
        }
      });
    });
    return tags.sort();
  }
  else if (sort == 'Status')
  {
    return ['Not Owned', 'Ordered','Owned','Premium Owned'];
  }
  else if (sort == 'Guilds')
  {
    return ['Azorius','Dimir','Rakdos','Gruul','Selesnya','Orzhov','Izzet','Golgari','Boros','Simic'];
  }
  else if (sort == 'Shards / Wedges')
  {
    return ['Bant','Esper','Grixis','Jund','Naya','Abzan','Jeskai','Sultai','Mardu','Temur'];
  }
  else if(sort == 'Color Count')
  {
    return ['0','1','2','3','4','5'];
  }
  else if (sort == 'Set')
  {
    var sets = [];
    cube.forEach(function(card, index)
    {
      if(!sets.includes(card.details.set.toUpperCase()))
      {
        sets.push(card.details.set.toUpperCase());
      }
    });
    return sets.sort();
  }
  else if (sort == 'Artist')
  {
    var artists = [];
    cube.forEach(function(card, index)
    {
      if(!artists.includes(card.details.artist))
      {
        artists.push(card.details.artist);
      }
    });
    return artists.sort();
  }
  else if (sort == 'Rarity')
  {
    return ['Common','Uncommon','Rare','Mythic'];
  }
  else if(sort == 'Unsorted')
  {
    return ['All'];
  }
  else if (sort == 'Subtype')
  {
    var types = [];
    cube.forEach(function(card, index)
    {
      if(card.details.type.includes('—'))
      {
        var subtypes = card.details.type.substr(card.details.type.indexOf('—')+1).split(' ');
        subtypes.forEach(function(subtype, index)
        {
          if(!types.includes(subtype.trim()) && subtype.trim().length > 0)
          {
            types.push(subtype.trim());
          }
        });
      }
    });
    return types.sort();
  }
  else if (sort == 'Types-Multicolor')
  {
    return ['Creature','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Conspiracy','Scheme','Vanguard','Phenomenon','Contraption','Plane','Land','Azorius','Dimir','Rakdos','Gruul','Selesnya','Orzhov',
      'Izzet','Golgari','Boros','Simic','Bant','Esper','Grixis','Jund','Naya','Abzan','Jeskai','Sultai','Mardu','Temur','Non-White','Non-Blue','Non-Black','Non-Red','Non-Green','Five Color'];
  }
  else if (sort=='Legality')
  {
    return ['Standard','Modern','Legacy','Vintage','Pauper'];
  }
  else if (sort == 'Power')
  {
    var items = [];
    cube.forEach(function(card, index)
    {
      if(card.details.power)
      {
        if(!items.includes(card.details.power))
        {
          items.push(card.details.power);
        }
      }
    });
    return items.sort(function(x, y)
    {
      if(!(/^\d+$/.test(x)) || !(/^\d+$/.test(y)))
      {
        if(x > y)
        {
          return 1;
        }
        else if(y > x)
        {
          return -1;
        }
        return 1;
      }
      if(parseInt(x) > parseInt(y))
      {
        return 1;
      }
      else if(parseInt(y) > parseInt(x))
      {
        return -1;
      }
      return 1;
    });
  }
  else if (sort == 'Toughness')
  {
    var items = [];
    cube.forEach(function(card, index)
    {
      if(card.details.toughness)
      {
        if(!items.includes(card.details.toughness))
        {
          items.push(card.details.toughness);
        }
      }
    });
    return items.sort(function(x, y)
    {
      if(!(/^\d+$/.test(x)) || !(/^\d+$/.test(y)))
      {
        if(x > y)
        {
          return 1;
        }
        else if(y > x)
        {
          return -1;
        }
        return 1;
      }
      if(parseInt(x) > parseInt(y))
      {
        return 1;
      }
      else if(parseInt(y) > parseInt(x))
      {
        return -1;
      }
      return 1;
    });
  }
  else if (sort == 'Loyalty')
  {
    var items = [];
    cube.forEach(function(card, index)
    {
      if(card.details.loyalty)
      {
        if(!items.includes(card.details.loyalty))
        {
          items.push(card.details.loyalty);
        }
      }
    });
    return items.sort(function(x, y)
    {
      if(!(/^\d+$/.test(x)) || !(/^\d+$/.test(y)))
      {
        if(x > y)
        {
          return 1;
        }
        else if(y > x)
        {
          return -1;
        }
        return 1;
      }
      if(parseInt(x) > parseInt(y))
      {
        return 1;
      }
      else if(parseInt(y) > parseInt(x))
      {
        return -1;
      }
      return 1;
    });
  }
  else if (sort == 'Manacost Type')
  {
    return ['Gold','Hybrid','Phyrexian'];
  }
  else if (sort == 'CNC')
  {
    return ['Creature','Non-Creature'];
  }
}

function getCardColorClass(card) {
  var type = card.details.type;
  var colors = card.colors;
  if(type.toLowerCase().includes('land'))
  {
    return 'lands';
  }
  else if(colors.length == 0)
  {
    return 'colorless';
  }
  else if(colors.length >  1)
  {
    return 'multi';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
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
  cards.forEach(function(card, index)
  {
    if(index!= 0)
    {
      res+='||';
    }
    res += '1 ' + card.details.name;
  });
  return res;
}

function init_groupcontextModal() {
	var links = document.getElementsByClassName("activateGroupContextModal");

	for(var i=0;i<links.length;i++)
  {
    links[i].addEventListener('click', (e) =>
    {
      e.preventDefault();
      var category1 = e.target.getAttribute("primarysort");
      var category2 = e.target.getAttribute("secondarysort");
      var matches = sortIntoGroups(sortIntoGroups(filteredCube(), sorts[0])[category1 ],sorts[1])[category2];
      groupContextModal.categories = [category1, category2];
      if(matches.length == 1)
      {
        show_contextModal(matches[0]);
      }
      else
      {
        groupSelect = matches;
        $('#groupContextModalTitle').html(sorts[0] + ': ' + category1 + ', ' + sorts[1] + ': ' + category2);
        var cardlist = "";

        cardlist += '<ul class="listgroup" style="padding:5px 0px;">';
        $('#groupContextModalTagsHiddenInput').val('');

        updateGroupTags();
        matches.forEach(function( card, index)
        {
          if(card.details.image_flip)
          {
            cardlist += '<li cardID="'+card.cardID+'" class="card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
          }
          else
          {
            cardlist += '<li cardID="'+card.cardID+'" class="card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'">';
          }
          cardlist += card.details.name+'</li>';
          cardlist += '</li>';
        });
        cardlist += '</ul">';
        $('#groupContextModalArea').html(cardlist);

        var statusHTML = "";
        var statuses = getLabels('Status');
        statusHTML += '<option selected value=""></option>';
        statuses.forEach(function(status, index)
        {
          statusHTML += '<option value="' + status+'">'+status+'</option>';
        });
        $('#groupContextModalStatusSelect').html(statusHTML);

        $('#groupContextBuyForm').attr('action', 'https://store.tcgplayer.com/massentry?partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
        $('#groupContextBuyHidden').val(createMassEntry(matches));

        autocard_init_class2('autocard');
        $('#groupContextModal').modal('show');
      }
    });
  }
}

function show_contextModal(card) {
  modalSelect = card;

  $('#contextModalTitle').html(card.details.name);
  $('#contextModalImg').attr('src',card.details.image_normal);
  $('#contextModalVersionSelect').html('');
  var statusHTML = "";
  var statuses = getLabels('Status');
  statuses.forEach(function(status, index)
  {
    if(card.status == status)
    {
      statusHTML += '<option selected value="' + status+'">'+status+'</option>';
    }
    else
    {
      statusHTML += '<option value="' + status+'">'+status+'</option>';
    }
  });
  $('#contextModalStatusSelect').html(statusHTML);

  var tagsText = "";
  card.tags.forEach(function(tag, index)
  {
    if(index != 0)
    {
       tagsText += ', ';
    }
    tagsText += tag;
  });
  $('#contextModalTagsHiddenInput').val(tagsText);

  updateTags();
  $('#contextModalTagsCMC').val(card.cmc);

  ['W','U','B','R','G'].forEach(function(color, index)
  {
    $('#contextModalCheckbox'+color).prop('checked', card.colors.includes(color));
  });

  $('#contextScryfallButton').attr('href',card.details.scryfall_uri);
  if(card.details.tcgplayer_id)
  {
    $('#contextBuyButton').attr('href','https://shop.tcgplayer.com/product/productsearch?id='+card.details.tcgplayer_id+'&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
  }
  else
  {
    $('#contextBuyButton').attr('href','https://shop.tcgplayer.com/productcatalog/product/show?ProductName='+encodeURIComponent(card.details.name)+'&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra');
  }
  fetch('/cube/api/getversions/'+card.cardID)
    .then(response => response.json())
    .then(function(json)
  {
    var versionHTML = "";

    json.cards.forEach(function(version, index)
    {
      var name = version.full_name.toUpperCase().substring(version.full_name.indexOf('[')+1,version.full_name.indexOf(']'));
      if(version._id == card.cardID)
      {
        versionHTML += '<option selected value="' + version._id+'">'+name+'</option>';
      }
      else
      {
        versionHTML += '<option value="' + version._id+'">'+name+'</option>';
      }
    });
    $('#contextModalVersionSelect').html(versionHTML);

    $('#contextModal').modal('show');
  });
}

function init_contextModal() {
	var links = document.getElementsByClassName("activateContextModal");

	for(var i=0;i<links.length;i++)
  {
    links[i].addEventListener('click', (e) =>
    {
      e.preventDefault();
      card = cubeDict[e.target.getAttribute("cardindex")];


      show_contextModal(card);
    });
  }
}

function sortIntoGroups(cards, sort) {
  var groups = {};
  var labels = getLabels(sort);
  labels.forEach(function(label, index)
  {
    group = [];

    cards.forEach(function(card, cardindex)
    {
      if(cardIsLabel(card, label, sort))
      {
        group.push(card);
      }
    });

    if(group.length > 0)
    {
      groups[label] = group;
    }
  });
  return groups;
}

function columnLength(sort, label) {
  var res = 0;
  var cards = filteredCube();

  cards.forEach(function(card, cardindex)
  {
    if(cardIsLabel(card, label, sort))
    {
      res += 1;
    }
  });
  return res;
}

function getFilterObj() {
  var filterobj = {};
  filters.forEach(function(filter, index)
  {
    if(!filterobj[filter.category])
    {
      filterobj[filter.category] = {in:[], out:[]};
    }
    if(filter.not)
    {
      filterobj[filter.category].out.push(filter);
    }
    else
    {
      filterobj[filter.category].in.push(filter);
    }
  });
  return filterobj;
}

function filteredCube() {
  if(filters.length == 0)
  {
    return cube;
  }
  filterobj = getFilterObj();

  var res = [];
  cube.forEach(function(card, index)
  {
    if(filterCard(card,filterobj))
    {
      res.push(card);
    }
  });
  return res;
}

function updateCubeList() {
  switch(view)
  {
    case 'table':
      return renderTableView();
    case 'spoiler':
      return renderVisualSpoiler();
    case 'curve':
      return renderCurveView();
    case 'list':
      return renderListView();
  }
}

function renderListView() {
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value;
  var columns = sortIntoGroups(filteredCube(), sorts[0]);
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    columns[column_label] = sortIntoGroups(columns[column_label],sorts[1]);
  });

  cards = [];
  var card_ids = [];
  Object.keys(columns).forEach(function(col, index)
  {
    Object.keys(columns[col]).forEach(function(rowgroup_label, rowgroup_index)
    {
      columns[col][rowgroup_label].forEach(function( card, index)
      {
        cards.push(card);
        card_ids.push(card.cardID);
      });
    });
  });
  cards = cards.splice(0,listGranularity);
  card_ids = card_ids.splice(0,listGranularity);

  fetch("/cube/api/getversions", {
    method: "POST",
    body: JSON.stringify(card_ids),
    headers:{
      'Content-Type': 'application/json'
    }
  }).then(response => response.json())
    .then(function(json)
  {
    var versiondict = json.dict;

    var res = '<h5>'+cards.length+'/'+cube.length+'</h5></br><table class="table">';
    res += '<thead>';
    var headers = ["","Name","Version","Status","CMC","Color","Tags"];
    headers.forEach(function(header, index)
    {
      res += '<th scope="col">'+header+'</th>';
    });
    res += '</thead>';
    for(i = 0; i < cards.length; i++)
    {
      res += '<tr class="listviewrow autocard '+getCardColorClass(cards[i])+'">';
      //checkbox col
      if(changes[i] && changes[i].checked)
      {
        res += '<td class="nostretch"><input id="tdcheck'+i+'" class="tdcheck" data-index="'+i+'" type="checkbox" checked></td>';
      }
      else
      {
        res += '<td class="nostretch"><input id="tdcheck'+i+'" class="tdcheck" data-index="'+i+'" type="checkbox" ></td>';
      }

      //name col
      res += '<td data-index="'+i+'" class="nostretch tdcard autocard" card="' + cards[i].details.image_normal +'"><div class="tdname">'+ cards[i].details.name+'</div></td>';

      //version col
      res += '<td data-index="'+i+'" class="nostretch">';
      res += '<select class="form-control versionselect">'
      versiondict[cards[i].cardID].forEach(function(version, index)
      {
        if(version.id == cards[i].cardID)
        {
          res += '<option selected>'+version.version+'</option>';
        }
        else
        {
          res += '<option>'+version.version+'</option>';
        }
      });
      res += '</select>'
      res += '</td>';

      //status col
      res += '<td data-index="'+i+'" class="nostretch">';
      var labels = getLabels('Status');
      res += '<select class="form-control versionselect">'
      labels.forEach(function(label, index)
      {
        if(cards[i].status == label)
        {
          res += '<option selected>'+label+'</option>';
        }
        else
        {
          res += '<option>'+label+'</option>';
        }
      });
      res += '</select>'
      res += '</td>';

      //CMC col
      res += '<td data-index="'+i+'" class="nostretch">';
      res += '<input class="form-control inputmd" value="'+cards[i].cmc+'">'
      res += '</td>';

      //color identiy col
      res += '<td data-index="'+i+'" class="nostretch">';
      var labels = ['C','W','U','B','R','G','WU','WB','WR','WG','UB','UR','UG','BR','BG','RG','WUB','WUR','WUG','WBR','WBG','WRG','UBR','UBG','URG','BRG','WUBR','WUBG','WURG','WBRG','UBRG','WUBRG'];
      res += '<select class="form-control inputl">'
      labels.forEach(function(label, index)
      {
        if(label == 'C' && cards[i].colors.count == 0)
        {
          res += '<option selected>'+label+'</option>';
        }
        else
        {
          var match = true;
          cards[i].colors.forEach(function(color, index)
          {
            if(!label.includes(color.toUpperCase()))
            {
              match = false;
            }
          })
          if(match && label.length == cards[i].colors.length)
          {
            res += '<option selected>'+label+'</option>';
          }
          else
          {
            res += '<option>'+label+'</option>';
          }
        }
      });
      res += '</select>'
      res += '</td>';

      //tags col
      res += '<td data-index="'+i+'" class="">';
      res += '<div class="tags-input" data-name="tags-input">';
      res += '<span class="tags">';
      cards[i].tags.forEach(function(tag,index)
      {
        res += '<span class="tag">'+tag+'</span>';
      });
      res += '</span>';
      res += '<input class="tags-input" type="hidden">';
      res += '<input class="main-input" type="hidden" maxLength="24">';
      res += '</div></td>';

      res += '</tr>';
    }
    res += '</table>'

    $('#cubelistarea').html(res);
    autocard_init_class3('autocard');
    $('.tdcheck').change(function(e)
    {
      var index = e.target.getAttribute('data-index');
      if(!changes[index])
      {
        changes[index] = {};
      }
      changes[index].checked = $(this).prop('checked');
    });
    $('.tdcard').click(function(e)
    {
      var index = e.target.getAttribute('data-index');
      if(!changes[index])
      {
        changes[index] = {checked:$('#tdcheck'+index).prop('checked')};
      }
      changes[index].checked = !changes[index].checked;
      renderListView();
    });
  });
}

function renderCurveView() {
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value

  var groups = sortIntoGroups(filteredCube(), sorts[0]);
  var groupcounts = {};
  Object.keys(groups).forEach(function(group_label, g_index)
  {
    groups[group_label] = sortIntoGroups(groups[group_label],'CNC');
    groupcounts[group_label] = 0;
    Object.keys(groups[group_label]).forEach(function(col_label, col_index)
    {
      groups[group_label][col_label] = sortIntoGroups(groups[group_label][col_label],'CMC2');
      Object.keys(groups[group_label][col_label]).forEach(function(label, index)
      {
        groups[group_label][col_label][label].sort(function(x, y)
        {
          if (x.cmc < y.cmc)
          {
            return -1;
          }
          if (x.cmc > y.cmc)
          {
            return 1;
          }
          if (x.details.name < y.details.name)
          {
            return -1;
          }
          if (x.details.name > y.details.name)
          {
            return 1;
          }
          return 0;
        });
        groupcounts[group_label] += groups[group_label][col_label][label].length;
      });
    });
  });


  //var res = '<em>Curve View ignores secondary sort</em></br>';
  var res = '';
  Object.keys(groups).forEach(function(group_label, group_index)
  {
    res += '<div class="card"><div class="card-header"><h5>'+group_label+' ('+groupcounts[group_label]+')</h5></div><div class="card-body">';

    var labels = getLabels('CNC');
    //creatures
    labels.forEach(function(label, index)
    {
      if(groups[group_label][label])
      {
        res += '<h6>'+label+'</h6>';
        res += '<div class="row even-cols">';
        var colWidth = Math.max(10,100.0 / getLabels('CMC2').length);
        getLabels('CMC2').forEach(function(col_label, col_index)
        {
          res += '<div class="col-even" style="width: '+colWidth+'%;">'
          res += '<ul class="list-group" style="padding:5px 0px;">';
          if(groups[group_label][label][col_label])
          {
            res += '<a class="list-group-item list-group-heading">'+col_label+ ' ('+ groups[group_label][label][col_label].length + ')</a>';
            groups[group_label][label][col_label].forEach(function( card, index)
            {
              if(card.details.image_flip)
              {
                res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
              }
              else
              {
                res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'">';
              }
              res += card.details.name+'</a>';
            });
          }
          else
          {
            res += '<a class="list-group-item list-group-heading">'+col_label+ ' (0)</a>';
          }

          res += '</div>'
        });
        res += '</div>'
      }
    });


    //noncreatures

    var group = groups[group_label];
    res += '</div></div></br>';
  });

  res += '</div>';
  $('#cubelistarea').html(res);

  autocard_init_class('autocard');
  init_contextModal();
}

function renderTableView() {
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value;
  var columns = sortIntoGroups(filteredCube(), sorts[0]);
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    columns[column_label] = sortIntoGroups(columns[column_label],sorts[1]);
  });

  var count = 0;

   Object.keys(columns).forEach(function(col, index)
   {
     if(Object.keys(columns[col]).length > 0)
     {
       count += 1;
     }
   });

  var colWidth = Math.max(10,100.0 / count);

  var res = '<div class="row even-cols">';
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    var column = columns[column_label];

    if(Object.keys(column).length > 0)
    {
      res += '<div class="col-even" style="width: '+colWidth+'%;">'
      res += '<h6>'+column_label+ ' ('+ columnLength(sorts[0],column_label) + ')</h6>';

      Object.keys(column).forEach(function(rowgroup_label, rowgroup_index)
      {
          var rowgroup = column[rowgroup_label];
          rowgroup.sort(function(x, y)
          {
            if (x.cmc < y.cmc)
            {
              return -1;
            }
            if (x.cmc > y.cmc)
            {
              return 1;
            }
            if (x.details.name < y.details.name)
            {
              return -1;
            }
            if (x.details.name > y.details.name)
            {
              return 1;
            }
            return 0;
          });

          res += '<ul class="list-group" style="padding:5px 0px;">';
          res += '<a '
          if(canEdit)
          {
            res += 'href="#"'
          }
          res += 'class="activateGroupContextModal list-group-item list-group-heading" primarysort="'+column_label+'" secondarysort="'+rowgroup_label+'">' + rowgroup_label +' ('+ rowgroup.length + ')</a>';

          rowgroup.forEach(function( card, index)
          {
            if(card.details.image_flip)
            {
              res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
            }
            else
            {
              res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'">';
            }
            res += card.details.name+'</a>';
          });

          res += '</ul">';
      });

      res += '</div>';
    }
  });

  res += '</div>';
  $('#cubelistarea').html(res);

  autocard_init_class('autocard');
  init_contextModal();
  if(canEdit)
  {
    init_groupcontextModal();
  }
}

function renderVisualSpoiler() {
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value;
  var columns = sortIntoGroups(filteredCube(), sorts[0]);
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    columns[column_label] = sortIntoGroups(columns[column_label],sorts[1]);
  });

  var count = 0;

   Object.keys(columns).forEach(function(col, index)
   {
     if(Object.keys(columns[col]).length > 0)
     {
       count += 1;
     }
   });

  var colWidth = Math.max(10,100.0 / count);

  var res = '<div class="row no-gutters"><div class="col">';
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    var column = columns[column_label];

    if(Object.keys(column).length > 0)
    {
      //res += '<h6>'+column_label+ ' ('+ columnLength(sorts[0],column_label) + ')</h6>';

      Object.keys(column).forEach(function(rowgroup_label, rowgroup_index)
      {
        var rowgroup = column[rowgroup_label];
        rowgroup.sort(function(x, y)
        {
          if (x.cmc < y.cmc)
          {
            return -1;
          }
          if (x.cmc > y.cmc)
          {
            return 1;
          }
          if (x.details.name < y.details.name)
          {
            return -1;
          }
          if (x.details.name > y.details.name)
          {
            return 1;
          }
          return 0;
        });

        rowgroup.forEach(function( card, index)
        {
          if(card.details.image_flip)
          {
            res += '<a href="#" class="autocard" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
          }
          else
          {
            res += '<a href="#" class="autocard" card="' + card.details.image_normal +'">';
          }
          res += '<img cardIndex="'+card.index+'" class="activateContextModal" src="'+card.details.image_normal+'" alt="'+card.details.name+'" width=150 height=210>';
          res += '</a>';
        });
      });

    }
  });

  res += '</div></div>';
  $('#cubelistarea').html(res);
  autocard_init_class('autocard');
  init_contextModal();
  if(canEdit)
  {
    init_groupcontextModal();
  }
}

function updateFilters() {
  sort_categories = getSorts();

  if(filters.length <= 0)
  {
    document.getElementById('filterarea').innerHTML = '<p><em>No active filters.</em></p>';
  }
  else
  {
    var filterhtml = "";
    filters.forEach(function(filter, index)
    {
      var itemshtml = "";
      var labels = getLabels(filter.category);
      labels.forEach(function(label,l_index)
      {
        itemshtml += filterItemTemplate.replace('#{value}',label).replace('#{label}',label);
      });
      filterhtml += filterTemplate.replace('#{items}',itemshtml)
        .replace('#{filterID}',filter.category + index)
        .replace('#{filterName}',filter.category)
        .replace('#{index}',index)
        .replace('#{buttonindex}',index)
        .replace('#{checkbox}','checkbox' + filter.category + index)
        .replace('#{filterindex}',index)
        .replace('#{checkboxindex}',index);
    });
    document.getElementById('filterarea').innerHTML = filterhtml;

    //setup filter control events
    filters.forEach(function(filter, index)
    {
      var element = document.getElementById(filter.category + index);
      element.selectedIndex = getLabels(filter.category).indexOf(filter.value);
      element.addEventListener('change',(e)=>
      {
        filters[e.target.getAttribute('data-index')].value = e.target.value;
      });

      element = document.getElementById('checkbox' + filter.category + index);
      element.checked = filter.not;
      element.addEventListener('change', (e) =>
      {
        filters[e.target.getAttribute('data-index')].not = e.target.checked;
      });
    });

    filterRemoveButtons = document.getElementsByClassName('filter-button');
  	for(var i=0;i<filterRemoveButtons.length;i++)
    {
      filterRemoveButtons[i].addEventListener('click', (e) =>
      {
        filters.splice(e.target.getAttribute('data-index'), 1);
        updateFilters();
      })
    }
  }
}

function buildFilterArea() {
  sort_categories = getSorts();
  var sorthtml = "";
  sort_categories.forEach(function(category, index)
  {
    sorthtml += filterItemTemplate.replace('#{value}',category).replace('#{label}',category);
  });

  document.getElementById('filterType').innerHTML = sorthtml;
  sorthtml += filterItemTemplate.replace('#{value}','Unsorted').replace('#{label}','Unsorted');
  document.getElementById('secondarySortSelect').innerHTML = sorthtml;
  document.getElementById('primarySortSelect').innerHTML = sorthtml;
  if(document.getElementById("sort1").value.length > 0 && document.getElementById("sort2").value.length > 0)
  {
    document.getElementById('primarySortSelect').selectedIndex = sort_categories.indexOf(document.getElementById("sort1").value);
    document.getElementById('secondarySortSelect').selectedIndex = sort_categories.indexOf(document.getElementById("sort2").value);
  }
  else
  {
    document.getElementById('primarySortSelect').selectedIndex = sort_categories.indexOf('Color Category');
    document.getElementById('secondarySortSelect').selectedIndex = sort_categories.indexOf('Types-Multicolor');
  }

  updateFilters();
}

var prev_handler = window.onload;
window.onload = function () {
    if (prev_handler) {
        prev_handler();
    }
    buildFilterArea();
    updateCubeList();
};
