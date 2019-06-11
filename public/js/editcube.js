// #cubecobralocalhost
//var baseURL='http://localhost:5000';
var baseURL='https://cubecobra.com';

var justAddButton = document.getElementById("justAddButton");
var removeButton = document.getElementById("removeButton");
var addInput = document.getElementById("addInput");
var removeInput = document.getElementById("removeInput");
var changelist = document.getElementById("changelist");
var saveChangesButton = document.getElementById("saveChangesButton");
var discardAllButton = document.getElementById("discardAllButton");
var changelistFormBody = document.getElementById("changelistFormBody");

justAddButton.addEventListener("click", justAddButtonClick);
removeButton.addEventListener("click", removeButtonClick);
discardAllButton.addEventListener("click", discardAllButtonClick);
saveChangesButton.addEventListener("click", saveChangesButtonClick);

var cubeID=document.getElementById("cubeID").value;
var changes = [];

function justAddButtonClick() {
  var val = addInput.value.replace('//','-slash-');
  if(val.length > 0)
  {
    fetch(baseURL+'/api/getcard/'+val)
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

function removeButtonClick() {
  var val = removeInput.value;
  if(val.length > 0)
  {
    fetch(baseURL+'/api/getcardfromcube/'+cubeID+';'+val)
      .then(response => response.json())
      .then(function(json)
    {
      if(json.card)
      {
        if(addInput.value.length > 0)
        {
          var val2 = addInput.value;
          fetch(baseURL+'/api/getcard/'+val2)
            .then(response2 => response2.json())
            .then(function(json2)
          {
            if(json2.card)
            {
              addInput.value = "";
              removeInput.value = "";
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
          removeInput.value = "";
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
    else if(change.remove)
    {
      changelistFormBody.value += '-' + change.remove._id;
    }
    else if(change.replace)
    {
      changelistFormBody.value += '-' + change.replace[0]._id + ';';
      changelistFormBody.value += '+' + change.replace[1]._id;
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

  if(changelist.innerHTML.length > 0)
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
