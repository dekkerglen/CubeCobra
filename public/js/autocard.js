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
	$('.'+classname).off('mouseover').on('mouseover', function(e)	{
		if(!stopAutocard)	{
			if($(this).attr("card_flip"))	{
				autocard_show_card_flip($(this).attr("card"),$(this).attr("card_flip"));
			}
			else {
				autocard_show_card($(this).attr("card"));
			}
		}
	});
	$('.'+classname).off('mouseout').on('mouseout', function(e)	{
		autocard_hide_card();
	});
}

function autocard_show_card(imagename) {
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
		if(bottomPixelSpace>340)
		{
			document.getElementById("autocard_popup").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
		else
		{
			document.getElementById("autocard_popup").style.top = (-320+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
	}
	document.getElementById("autocard_popup").innerHTML = '<img src="' + imagename + '" width=225 height=315>';
}

function autocard_show_card_flip(imagename, imagename2) {
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
		if(bottomPixelSpace>340)
		{
			document.getElementById("autocard_popup2").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
			document.getElementById("autocard_popup").style.top = (5+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
		else
		{
			document.getElementById("autocard_popup2").style.top = (-320+e.clientY+self.pageYOffset-parentPos.top) + "px";
			document.getElementById("autocard_popup").style.top = (-320+e.clientY+self.pageYOffset-parentPos.top) + "px";
		}
	}
	document.getElementById("autocard_popup2").innerHTML = '<img src="' + imagename2 + '" width=225 height=315>';
	document.getElementById("autocard_popup").innerHTML = '<img src="' + imagename + '" width=225 height=315>';
}

function autocard_hide_card() {
	document.getElementById("autocard_popup").innerHTML = '';
	document.getElementById("autocard_popup2").innerHTML = '';
}

autocard_init('autocard');
