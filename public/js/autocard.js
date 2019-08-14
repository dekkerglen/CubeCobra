var stopAutocard = false;

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
	$('.'+classname).off('mouseover').on('mouseover', function(e) {
		if(!stopAutocard) {
            let tags = $(this).attr("card_tags") ? $(this).attr("card_tags").split(',') : null;
			autocard_show_card($(this).attr("card"), $(this).attr("card_flip"), $(this).hasClass('autocard-art-crop'), tags);
		}
	});
	$('.'+classname).off('mouseout').on('mouseout', function(e)	{
		autocard_hide_card();
	});
}

function autocard_show_card(card_image, card_flip, show_art_crop, tags) {
    var w = (card_flip) ? 425 : 250;
    if(tags) w += 100;

    var h = (show_art_crop) ? 165 : 315;

	document.onmousemove = function(e){
		if(window.event){e = window.event;}
        el = document.getElementById("autocard_popup");
        parentPos = getElementPosition(el.parentElement.parentElement);

	  var leftPixelSpace = e.clientX;
	  var rightPixelSpace = window.innerWidth - leftPixelSpace;
	  var topPixelSpace = e.clientY;
	  var bottomPixelSpace = window.innerHeight - topPixelSpace;

        var x_offset = e.clientX+self.pageXOffset-parentPos.left;
        var y_offset = e.clientY+self.pageYOffset-parentPos.top;

		if(rightPixelSpace > w)
		{
            //display on right
            var flip_offset = (card_flip) ? 225 : 0;
			document.getElementById("autocard_popup").style.left = (5+x_offset) + "px";
			document.getElementById("autocard_popup2").style.left = (230+x_offset) + "px";
			document.getElementById("autocard_popup_info").style.left = (230+flip_offset+x_offset) + "px";
		}
		else
		{
            //display on left
            let card_offset = (card_flip) ? 455 : 230;
            let tags_offset = (tags) ? 100 : 0;
			document.getElementById("autocard_popup").style.left = (-(card_offset+tags_offset)+x_offset) + "px";
			document.getElementById("autocard_popup2").style.left = (-(230+tags_offset)+x_offset) + "px";
			document.getElementById("autocard_popup_info").style.left = (-105+x_offset) + "px";
		}
		if(bottomPixelSpace > h+25)
		{
            //display on bottom
			document.getElementById("autocard_popup").style.top = (5+y_offset) + "px";
			document.getElementById("autocard_popup2").style.top = (5+y_offset) + "px";
			document.getElementById("autocard_popup_info").style.top = (5+y_offset) + "px";
		}
		else
		{
            //display on top
			document.getElementById("autocard_popup").style.top = (-(h+5)+y_offset) + "px";
			document.getElementById("autocard_popup2").style.top = (-(h+5)+y_offset) + "px";
			document.getElementById("autocard_popup_info").style.top = (-(h+5)+y_offset) + "px";
		}
	}
	document.getElementById("autocard_popup").innerHTML = '<img src="' + card_image + '" width=225 height=' + h + '>';
    if(card_flip)
    {
        document.getElementById("autocard_popup2").innerHTML = '<img src="' + card_flip + '" width=225 height=' + h + '>';
    }
    if(tags)
    {
		document.getElementById("autocard_popup_info").style.width = "100px";
		document.getElementById("autocard_popup_info").style.height = h + "px";
        let tagsText = '<div class="autocard-tags">';
        tags.forEach(function(tag, index)
        {
            tagsText += "<span class='tag'>"+tag.trim()+"<span tag-data='"+tag.trim()+"' class='close-tag'></span></span>";
        });
        tagsText += '</div>';
        document.getElementById("autocard_popup_info").innerHTML = tagsText;
    }
}

function autocard_hide_card() {
	document.getElementById("autocard_popup").innerHTML = '';
	document.getElementById("autocard_popup2").innerHTML = '';
	document.getElementById("autocard_popup_info").innerHTML = '';
}

autocard_init('autocard');
autocard_init('dynamic-autocard');
