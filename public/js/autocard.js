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
            let art_crop = $(this).hasClass('autocard-art-crop');
			if($(this).attr("card_tags")) {
                console.log($(this).attr("card_tags"));
            }
			if($(this).attr("card_flip")) {
				autocard_show_card_flip($(this).attr("card"),$(this).attr("card_flip"), art_crop);
			}
			else {
				autocard_show_card($(this).attr("card"), art_crop);
			}
		}
	});
	$('.'+classname).off('mouseout').on('mouseout', function(e)	{
		autocard_hide_card();
	});
}

function autocard_show_card(imagename, art_crop) {
    var h = (art_crop) ? 165 : 315;
	document.onmousemove = function(e){
		if(window.event){e = window.event;}
        el = document.getElementById("autocard_popup");
        parentPos = getElementPosition(el.parentElement.parentElement);

	  var leftPixelSpace = e.clientX;
	  var rightPixelSpace = window.innerWidth - leftPixelSpace;
	  var topPixelSpace = e.clientY;
	  var bottomPixelSpace = window.innerHeight - topPixelSpace;
		if(rightPixelSpace > 250)
		{
			//display on right
			document.getElementById("autocard_popup").style.left = (5+e.clientX+self.pageXOffset-parentPos.left) + "px";
		}
		else
		{
			document.getElementById("autocard_popup").style.left = (-230+e.clientX+self.pageXOffset-parentPos.left) + "px";
		}
		if(bottomPixelSpace > h+25)
		{
			document.getElementById("autocard_popup").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
		else
		{
			document.getElementById("autocard_popup").style.top = (-(h+5)+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
	}
	document.getElementById("autocard_popup").innerHTML = '<img src="' + imagename + '" width=225 height=' + h + '>';
}

function autocard_show_card_flip(imagename, imagename2, art_crop) {
    var h = (art_crop) ? 165 : 315;
	document.onmousemove = function(e){
		if(window.event){e = window.event;}
        el = document.getElementById("autocard_popup");
        parentPos = getElementPosition(el.parentElement.parentElement);

	  var leftPixelSpace = e.clientX;
	  var rightPixelSpace = window.innerWidth - leftPixelSpace;
	  var topPixelSpace = e.clientY;
	  var bottomPixelSpace = window.innerHeight - topPixelSpace;
		if(rightPixelSpace > 425)
		{
			//display on right
			document.getElementById("autocard_popup2").style.left = (230+e.clientX+self.pageXOffset-parentPos.left) + "px";
			document.getElementById("autocard_popup").style.left = (5+e.clientX+self.pageXOffset-parentPos.left) + "px";
		}
		else
		{
			document.getElementById("autocard_popup2").style.left = (-455+e.clientX+self.pageXOffset-parentPos.left) + "px";
			document.getElementById("autocard_popup").style.left = (-230+e.clientX+self.pageXOffset-parentPos.left) + "px";
		}
		if(bottomPixelSpace > h+25)
		{
			document.getElementById("autocard_popup2").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
			document.getElementById("autocard_popup").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
		else
		{
			document.getElementById("autocard_popup2").style.top = (-(h+5)+e.clientY+self.pageYOffset-parentPos.top) + "px";
			document.getElementById("autocard_popup").style.top = (-(h+5)+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
	}
	document.getElementById("autocard_popup2").innerHTML = '<img src="' + imagename2 + '" width=225 height=' + h + '>';
	document.getElementById("autocard_popup").innerHTML = '<img src="' + imagename + '" width=225 height=' + h + '>';
}

function autocard_hide_card() {
	document.getElementById("autocard_popup").innerHTML = '';
	document.getElementById("autocard_popup2").innerHTML = '';
}

autocard_init('autocard');
autocard_init('dynamic-autocard');
