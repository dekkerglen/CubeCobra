function getElementPosition(el) {
	var l = 0, t = 0;
	while (el.offsetParent) {
		l += el.offsetLeft;
		t += el.offsetTop;
		el = el.offsetParent;
	}
	return {left:l, top:t};
}

function autocard_init(){
	var links = document.getElementsByTagName("li");
	for(var i=0;i<links.length;i++){
		if(links[i].className.includes("autocard")){
			links[i].onmouseover = autocard_showcard_helper(links[i].getAttribute("card"));
			links[i].onmouseout = function(){autocard_hide_card();};
}}}
function autocard_init2(){
	var links = document.getElementsByTagName("a");
	for(var i=0;i<links.length;i++){
		if(links[i].className.includes("autocard")){
			links[i].onmouseover = autocard_showcard_helper(links[i].getAttribute("card"));
			links[i].onmouseout = function(){autocard_hide_card();};
}}}

function autocard_init_class(htmlclass) {
	var links = document.getElementsByTagName("a");
	for(var i=0;i<links.length;i++){
		if(links[i].className.includes(htmlclass)){
			links[i].onmouseover = autocard_showcard_helper(links[i].getAttribute("card"));
			links[i].onmouseout = function(){autocard_hide_card();};
}}}

function autocard_showcard_helper(cardname) {
	return function() {autocard_show_card(cardname);}
}

function autocard_show_card(imagename){
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

function autocard_hide_card(){
	document.getElementById("autocard_popup").innerHTML = '';
}
autocard_init();
autocard_init2();
