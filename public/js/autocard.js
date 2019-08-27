var stopAutocard = false;
var autocardTimeout = null;

function getElementPosition(el) {
  var l = 0, t = 0;
  while (el.offsetParent) {
    l += el.offsetLeft;
    t += el.offsetTop;
    el = el.offsetParent;
  }
  return {left:l, top:t};
}

function autocard_init(classname) {
  $('.'+classname).off('mouseenter').on('mouseenter', function(e) {
    if(!stopAutocard) {
      console.log('fired');

      let tags = $(this).attr("card_tags") ? $(this).attr("card_tags").split(',') : null;
      autocard_show_card($(this).attr("card"), $(this).attr("card_flip"), $(this).hasClass('autocard-art-crop'), tags);
    }
  });
  $('.'+classname).off('mouseleave').on('mouseleave', function(e) {
    autocard_hide_card();
  });
}

function autocard_show_card(card_image, card_flip, show_art_crop, tags) {
  var w = (card_flip) ? 425 : 250;
  var h = (show_art_crop) ? 165 : 315;

  document.onmousemove = function(e) {
    if(window.event){e = window.event;}
    el = document.getElementById("autocard_popup");
    parentPos = getElementPosition(el.parentElement.parentElement);

    var leftPixelSpace = e.clientX;
    var rightPixelSpace = window.innerWidth - leftPixelSpace;
    var topPixelSpace = e.clientY;
    var bottomPixelSpace = window.innerHeight - topPixelSpace;

    var x_offset = e.clientX+self.pageXOffset-parentPos.left;
    var y_offset = e.clientY+self.pageYOffset-parentPos.top;
    let tag_offset = (tags) ? $(document.getElementById("autocard_popup_info")).outerHeight() : 0;

    if(rightPixelSpace > w)
    {
      //display on right
      document.getElementById("autocard_popup").style.left = (5+x_offset) + "px";
      document.getElementById("autocard_popup2").style.left = (230+x_offset) + "px";
      document.getElementById("autocard_popup_info").style.left = (5+x_offset) + "px";
    }
    else
    {
      //display on left
      let card_offset = (card_flip) ? 455 : 230;
      document.getElementById("autocard_popup").style.left = (-card_offset+x_offset) + "px";
      document.getElementById("autocard_popup2").style.left = (-230+x_offset) + "px";
      document.getElementById("autocard_popup_info").style.left = (-card_offset+x_offset) + "px";
    }
    if(bottomPixelSpace > h+25+tag_offset)
    {
      //display on bottom
      document.getElementById("autocard_popup").style.top = (5+y_offset) + "px";
      document.getElementById("autocard_popup2").style.top = (5+y_offset) + "px";
      document.getElementById("autocard_popup_info").style.top = (5+h+y_offset) + "px";
    }
    else
    {
      //display on top
      document.getElementById("autocard_popup").style.top = Math.max(0,(-(h+5+tag_offset)+y_offset)) + "px";
      document.getElementById("autocard_popup2").style.top = Math.max(0,(-(h+5+tag_offset)+y_offset)) + "px";
      document.getElementById("autocard_popup_info").style.top = Math.max((h),(-(5+tag_offset)+y_offset)) + "px";
    }
  }
  document.getElementById("autocard_popup").innerHTML = '<img src="" width=225 height=' + h + '>';
  if(card_flip)
  {
    document.getElementById("autocard_popup2").innerHTML = '<img src="" width=225 height=' + h + '>';
  }
  $(document.getElementById("autocard_popup")).find('img').attr('src', card_image);
  if(card_flip) $(document.getElementById("autocard_popup2")).find('img').attr('src', card_flip);

  if(tags)
  {
    w = (card_flip) ? 450 : 225;
    document.getElementById("autocard_popup_info").style.width = w + "px";
    let tagsText = '<div class="autocard-tags">';
    tags.forEach(function(tag, index)
    {
      tagsText += "<span class='tag'>"+tag.trim()+"</span>";
    });
    tagsText += '</div>';
    document.getElementById("autocard_popup_info").innerHTML = tagsText;
  }

  // only show the three autocard divs once the images are done loading
  $(document.getElementById("autocard_popup")).find('img')
    .one('load', function() { // only fill in tags area once the image is done loading
        if(card_flip)
        {
          $(document.getElementById("autocard_popup2")).find('img')
            .one('load', function() { // only fill in tags area once the image is done loading
              if(autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
              autocardTimeout = setTimeout(function() {
                $(document.getElementById("autocard_popup")).show();
                $(document.getElementById("autocard_popup2")).show();
                $(document.getElementById("autocard_popup_info")).show();
              }, 50);
            })
            .attr('src', card_flip) // set the image source so it begins fetching
            .each(function() {
              // fix for browsers that don't trigger .load() for cached images
              if(this.complete) $(this).trigger('load');
            });
        }
        else
        {
          if(autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
          autocardTimeout = setTimeout(function() {
            $(document.getElementById("autocard_popup")).show();
            $(document.getElementById("autocard_popup_info")).show();
          }, 50);
        }
    })
    .attr('src', card_image) // set the image source so it begins fetching
    .each(function() {
      // fix for browsers that don't trigger .load() for cached images
      if(this.complete) $(this).trigger('load');
    });
}

function autocard_hide_card() {
  document.getElementById("autocard_popup").innerHTML = '';
  document.getElementById("autocard_popup2").innerHTML = '';
  document.getElementById("autocard_popup_info").innerHTML = '';

  // clear any load events that haven't fired yet so that they don't fire after the card should be hidden
  if(autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
  $(document.getElementById("autocard_popup")).find('img').off('load');
  $(document.getElementById("autocard_popup2")).find('img').off('load');

  $(document.getElementById("autocard_popup")).hide();
  $(document.getElementById("autocard_popup2")).hide();
  $(document.getElementById("autocard_popup_info")).hide();
}

autocard_init('autocard');
autocard_init('dynamic-autocard');
