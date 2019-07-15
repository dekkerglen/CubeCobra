// #cubecobralocalhost
//var baseURL='http://localhost:5000';
var baseURL='https://cubecobra.com';

var justAddButton = document.getElementById("justAddButton");
var addInput = document.getElementById("addInput");
var changelist = document.getElementById("changelist");
var saveChangesButton = document.getElementById("saveChangesButton");
var changelistFormBody = document.getElementById("changelistFormBody");

justAddButton.addEventListener("click", justAddButtonClick);
saveChangesButton.addEventListener("click", saveChangesButtonClick);

var changes = [];

function justAddButtonClick() {
  var val = addInput.value.replace('//','-slash-');
  if(val.length > 0)
  {
    fetch(baseURL+'/cube/api/getcard/'+val)
      .then(response => response.json())
      .then(function(json)
    {
      if(json.card)
      {
        addInput.value = "";
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

function discardAllButtonClick()
{
  changes = [];
  updateCollapse();
}

function saveChangesButtonClick()
{
  changes.forEach(function(change, index)
  {
    if(index != 0)
    {
      changelistFormBody.value += ';';
    }
    if(change.add)
    {
      changelistFormBody.value += '+' + change.add._id;
    }
  });
  document.getElementById("changelistForm").submit();
}


function updateCollapse()
{
  var val = "";
  changes.forEach(function(change, index)
  {
    val += "<a style='color:red;font-weight: bold;text-decoration: underline;' id='clickx" + index+ "' href=#>x</a> ";
    if(change.add)
    {
      val += '<span class="badge badge-success">+</span> ';
      val += '<a class="dynamic-autocard" card="'+ change.add.image_normal + '">' + change.add.name + '</a>';
    }
    else if(change.remove)
    {
      val += '<span class="badge badge-danger">–</span> ';
      val += '<a class="dynamic-autocard" card="'+ change.remove.image_normal + '">' + change.remove.name + '</a>';
    }
    else if(change.replace)
    {
      val += '<span class="badge badge-primary">→</span> ';
      val += '<a class="dynamic-autocard" card="'+ change.replace[0].image_normal + '">' + change.replace[0].name + '</a> > ';
      val += '<a class="dynamic-autocard" card="'+ change.replace[1].image_normal + '">' + change.replace[1].name + '</a>';
    }
    val += "<br>"
  });

  changelist.innerHTML = val;

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

function init_bulkconfirm()
{
  var addedhidden = document.getElementById('addedcardshidden');
  var added = JSON.parse(addedhidden.value);
  added.forEach(function(add, index)
  {
    changes.push({add:add})
  });
  updateCollapse();
}


var prev_handler = window.onload;
window.onload = function () {
    if (prev_handler) {
        prev_handler();
    }
    init_bulkconfirm();
};
