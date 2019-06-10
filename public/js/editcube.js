var justAddButton = document.getElementById("justAddButton");
var removeButton = document.getElementById("removeButton");
var addInput = document.getElementById("addInput");
var removeInput = document.getElementById("removeInput");
var changelist = document.getElementById("changelist");
var saveChangesButton = document.getElementById("saveChangesButton");
var discardAllButton = document.getElementById("discardAllButton");

justAddButton.addEventListener("click", justAddButtonClick);
removeButton.addEventListener("click", removeButtonClick);
discardAllButton.addEventListener("click", discardAllButtonClick);
saveChangesButton.addEventListener("click", saveChangesButtonClick);

var changes = [];

function justAddButtonClick() {
  var val = addInput.value;
  if(val.length > 0)
  {
    fetch('http://localhost:5000/api/getcard/'+val)
      .then(response => response.json())
      .then(function(json)
    {
      addInput.value = "";
      changes.push({add:json.card})
      updateCollapse();
    });
  }
}

function removeButtonClick() {
  if(addInput.value.length > 0)
  {
    var add = addInput.value;
    var rm = removeInput.value;
    if(rm.length > 0)
    {
      addInput.value = "";
      removeInput.value = "";
      changes.push({replace:[add,rm]})
    }
  }
  else
  {
    var val = removeInput.value;
    if(val.length > 0)
    {
      removeInput.value = "";
      changes.push({remove:val})
    }
  }
  updateCollapse();
}

function discardAllButtonClick()
{
  changes = [];
  updateCollapse();
}

function saveChangesButtonClick()
{
  document.getElementById("changelistForm").submit();
}

function updateCollapse()
{
  var val = "";
  changes.forEach(function(change, index)
  {
    val += "<a style='color:red;font-weight: bold;text-decoration: underline;' href=#>x</a> ";
    if(change.add)
    {
      val += '<span class="badge badge-success">+</span> ';
      val += '<a href="" class="thumb">' + change.add.name + '<span><img src="' + change.add.image_normal + '" alt="" width="250" height="350"/></span></a>';
    }
    else if(change.remove)
    {
      val += '<span class="badge badge-danger">–</span> ' + change.remove;
    }
    else if(change.replace)
    {
      val += '<span class="badge badge-primary">→</span> ' + change.replace[0]  + ' > ' + change.replace[1];
    }
    val += "<br>"
  });

  changelist.innerHTML = val;

  if(changelist.innerHTML.length > 0)
  {
    $('.editForm').collapse("show");
  }
  else {
    $('.editForm').collapse("hide")
  }
}
