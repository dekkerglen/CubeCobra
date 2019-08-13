function autocompleteByTree(inp, tree, images, submit_button) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", function(e) {
      var a, b, i, val = this.value;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      if (!val) { return false;}
      currentFocus = -1;
      /*create a DIV element that will contain the items (values):*/
      a = document.createElement("DIV");
      a.setAttribute("id", this.id + "autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      /*append the DIV element as a child of the autocomplete container:*/
      this.parentNode.appendChild(a);
      /*for each item in the array...*/
      matches = getAllMatches(tree, val);
      for (i = 0; i < matches.length; i++) {
        /*check if the item starts with the same letters as the text field value:*/
        /*create a DIV element for each matching element:*/
        b = document.createElement("DIV");

        // Add an autocard to the div
        b.setAttribute("class", "autocard");
        let image = images[matches[i].toLowerCase()];
        b.setAttribute("card", image.image_normal);
        if(image.image_flip)
        {
          b.setAttribute("card_flip", image.image_flip);
        }

        b.innerHTML = "<strong>" + matches[i].substr(0, val.length) + "</strong>";
        b.innerHTML += matches[i].substr(val.length);
        /*insert a input field that will hold the current array item's value:*/
        b.innerHTML += "<input type='hidden' value='" + matches[i].replace("'","%27") + "'>";

        /*execute a function when someone clicks on the item value (DIV element):*/
        b.addEventListener("click", function(e) {
            /*insert the value for the autocomplete text field:*/
            inp.value = this.getElementsByTagName("input")[0].value.replace("%27","'");
            /*close the list of autocompleted values,
            (or any other open lists of autocompleted values:*/
            closeAllLists();
        });
        a.appendChild(b);
      }
      autocard_init('autocard');
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
          if (x) x[currentFocus].click();
        }
      }else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) x[currentFocus].click();
          temp_button = document.getElementById("justAddButton");
          if(submit_button)
          {
            submit_button.click();
            inp.focus();
          }
        }
      }
  });
  function getAllMatches(names, current)
  {
    var posts = getPosts(names, current);
    var words= treeToWords(posts, 10).slice(0,10);

    for(var i = 0; i < words.length; i++)
    {
      words[i] = current + words[i];
      words[i] = words[i].substr(0,words[i].length - 1);
    }
    return words;
  }
  function getPosts(names, current)
  {
    if(current == '')
    {
      return names;
    }
    else
    {
      character = current.charAt(0);
      var sub = current.substr(1, current.length)

      //please don't try to understand why this works
      if((character.toUpperCase() != character.toLowerCase())&& (names[character.toUpperCase()] && names[character.toLowerCase()]))
      {
        if(names[character.toUpperCase()][sub.charAt(0)])
        {
          var upper = getPosts(names[character.toUpperCase()],sub);
          if(names[character.toLowerCase()])
          {
            var lower = getPosts(names[character.toLowerCase()],sub);
            var res = deepmerge(upper,lower);
            return res;
          }
          else {
            return upper;
          }
        }
        else
        {
          var lower = getPosts(names[character.toLowerCase()],sub);
          if(names[character.toUpperCase()])
          {
            var upper = getPosts(names[character.toUpperCase()],sub);
            var res = deepmerge(upper,lower);
            return res;
          }
          else {
            return lower;
          }
        }
      }
      else if(names[character.toUpperCase()])
      {
        return getPosts(names[character.toUpperCase()],sub);
      }
      else if(names[character.toLowerCase()])
      {
        return getPosts(names[character.toLowerCase()],sub);
      }
      else
      {
        return {};
      }
    }
  }
  function treeToWords(tree, max)
  {
    if(isEmpty(tree))
    {
      return [];
    }
    else
    {
      var words = []
      for(var prop in tree)
      {
        if(tree.hasOwnProperty(prop))
        {
          if(isEmpty(tree[prop]))
          {
            words.push(prop);
          }
          wordlets = treeToWords(tree[prop],max);
          for(var i = 0; i < wordlets.length; i++)
          {
            words.push(prop + wordlets[i]);
          }
        }
        if(words.length > max)
        {
          return words;
        }
      }
      return words;
    }
  }
  function isEmpty(obj)
  {
    for(var prop in obj)
    {
        if(obj.hasOwnProperty(prop))
        {
            return false;
        }
    }
    return true;
  }

  //Deepmerge utility
  function isMergeableObject(val) {
      var nonNullObject = val && typeof val === 'object'

      return nonNullObject
          && Object.prototype.toString.call(val) !== '[object RegExp]'
          && Object.prototype.toString.call(val) !== '[object Date]'
  }
  function emptyTarget(val) {
      return Array.isArray(val) ? [] : {}
  }
  function cloneIfNecessary(value, optionsArgument) {
      var clone = optionsArgument && optionsArgument.clone === true
      return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
  }
  function defaultArrayMerge(target, source, optionsArgument) {
      var destination = target.slice()
      source.forEach(function(e, i) {
          if (typeof destination[i] === 'undefined') {
              destination[i] = cloneIfNecessary(e, optionsArgument)
          } else if (isMergeableObject(e)) {
              destination[i] = deepmerge(target[i], e, optionsArgument)
          } else if (target.indexOf(e) === -1) {
              destination.push(cloneIfNecessary(e, optionsArgument))
          }
      })
      return destination
  }
  function mergeObject(target, source, optionsArgument) {
      var destination = {}
      if (isMergeableObject(target)) {
          Object.keys(target).forEach(function (key) {
              destination[key] = cloneIfNecessary(target[key], optionsArgument)
          })
      }
      Object.keys(source).forEach(function (key) {
          if (!isMergeableObject(source[key]) || !target[key]) {
              destination[key] = cloneIfNecessary(source[key], optionsArgument)
          } else {
              destination[key] = deepmerge(target[key], source[key], optionsArgument)
          }
      })
      return destination
  }
  function deepmerge(target, source, optionsArgument) {
      var array = Array.isArray(source);
      var options = optionsArgument || { arrayMerge: defaultArrayMerge }
      var arrayMerge = options.arrayMerge || defaultArrayMerge

      if (array) {
          return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument)
      } else {
          return mergeObject(target, source, optionsArgument)
      }
  }
  deepmerge.all = function deepmergeAll(array, optionsArgument) {
      if (!Array.isArray(array) || array.length < 2) {
          throw new Error('first argument should be an array with at least two elements')
      }

      // we are sure there are at least 2 values, so it is safe to have no initial value
      return array.reduce(function(prev, next) {
          return deepmerge(prev, next, optionsArgument)
      })
  }


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
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
	autocard_hide_card();
  }
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
      closeAllLists(e.target);
  });
}

window.onload = async () => {
  //load the card names
  if(document.getElementById("removeInput"))
  {
    var cubeID=document.getElementById("cubeID").value;
    const response2 = await fetch('/cube/api/cubecardnames/'+cubeID);
    const myJson2 = await response2.json();
    var cubenames = myJson2.cardnames;
  }
  const response = await fetch('/cube/api/cardnames');
  const myJson = await response.json();
  var cardnames = myJson.cardnames;

  const image_resp = await fetch('/cube/api/cardimages');
  const image_json = await image_resp.json();
  var cardimages = image_json.cardimages;

  /*initiate the autocomplete function on the "myInput" element, and pass along the cardnames array as possible autocomplete values:*/
  if(document.getElementById("addInput"))
  {
    autocompleteByTree(document.getElementById("addInput"), cardnames, cardimages, document.getElementById("justAddButton"));
  }
  if(document.getElementById("removeInput"))
  {
    autocompleteByTree(document.getElementById("removeInput"), cubenames, cardimages, document.getElementById("removeButton"));
  }
}
