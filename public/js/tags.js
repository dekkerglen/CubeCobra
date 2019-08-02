function submitTag(current) {
  var tag =  $(current).find('.main-input').val();
  $(current).find('.main-input').val('');
  var val = $(current).find('.hidden-input').val();
  if(val.length > 0)
  {
    val += ', ' + tag;
  }
  else
  {
    val = tag;
  }
  $(current).find('.hidden-input').val(val);
  $(current).find('.hidden-input').trigger('change');
}

function activateTags()
{
  //focus tag text box when anywhere is clicked
  $('.tags-area').off('click').on('click', function(e)
  {
    $(this).find('.main-input').focus();
  });

  //if tags hidden area changes, update the tags
  $('.tags-area').find('.hidden-input').off('change').on('change', function(e)
  {
    var tagsText = "";
    $(this).val().split(',').forEach(function(tag, index)
    {
      if(tag.trim() != "")
      {
        tagsText += "<span class='tag'>"+tag.trim()+"<span tag-data='"+tag.trim()+"' class='close-tag'></span></span>";
      }
    });
    $(this).parent().find('.tags').html(tagsText);

    //enable the close tags
    $(this).parent().find('.tags').find('.close-tag').off('click').on('click', function(e)
    {
      var remove = $(this).attr('tag-data').trim();
      newtags = $(this).parent().parent().parent().find('.hidden-input').val().split(',').filter(function(element) {
        return element.trim() !== remove;
      });

      var tagsText = "";
      newtags.forEach(function(tag, index)
      {
        if(index != 0)
        {
           tagsText += ', ';
        }
        tagsText += tag;
      });
      $(this).parent().parent().parent().find('.hidden-input').val(tagsText);
      $(this).parent().parent().parent().find('.hidden-input').trigger('change');
    });
  });

  //autocomplete for tags
  $('.tags-area').each(function(index)
  {
    $(this).find('.hidden-input').trigger('change');

    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    $(this).find('.main-input').off('input').on('input',function(e) {
      var a, b, i, val = this.value;
      var cur = this;
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
            $(cur).parent().find('.main-input').val(this.getElementsByTagName("input")[0].value.replace("%27","'"));
            submitTag($(cur).parent());
            closeAllLists();
          });
          a.appendChild(b);
        }
      }
    });
    /*execute a function presses a key on the keyboard:*/
    $(this).find('.main-input').off('keydown').on('keydown',function(e) {
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
            submitTag($(this).parent().parent());
            closeAllLists();
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
            submitTag($(this).parent().parent());
            closeAllLists();
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
      var x = document.getElementsByClassName("autocomplete-items");
      for (var i = 0; i < x.length; i++) {
        if (elmnt != x[i]) {
          x[i].parentNode.removeChild(x[i]);
        }
      }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
  });
}
