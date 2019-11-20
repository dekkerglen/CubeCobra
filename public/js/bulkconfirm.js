var justAddButton = document.getElementById('justAddButton');
var addInput = document.getElementById('addInput');
var changelist = document.getElementById('changelist');
var saveChangesButton = document.getElementById('saveChangesButton');
var changelistFormBody = document.getElementById('changelistFormBody');

justAddButton.addEventListener('click', justAddButtonClick);
saveChangesButton.addEventListener('click', saveChangesButtonClick);

var changes = [];

function justAddButtonClick() {
  var val = addInput.value.replace('?', '-q-');
  while (val.includes('//')) {
    val = val.replace('//', '-slash-');
  }
  if (val.length > 0) {
    fetch('/cube/api/getcard/' + val)
      .then((response) => response.json())
      .then(function(json) {
        if (json.card) {
          addInput.value = '';
          changes.push({
            add: json.card,
          });
          updateCollapse();
          $('.warnings').collapse('hide');
        } else {
          $('.warnings').collapse('show');
        }
      });
  }
}

function discardAllButtonClick() {
  changes = [];
  updateCollapse();
}

function saveChangesButtonClick() {
  var val = '';
  changes.forEach(function(change, index) {
    if (index != 0) {
      val += ';';
    }
    if (change.add) {
      val += '+' + change.add._id;
    }
  });
  changelistFormBody.value = val;
  document.getElementById('changelistForm').submit();
}

function updateCollapse() {
  var val = '';
  changes.forEach(function(change, index) {
    val += "<a style='color:red;font-weight: bold;text-decoration: underline;' id='clickx" + index + "' href=#>x</a> ";
    if (change.add) {
      val += '<span class="badge badge-success">+</span> ';
      if (change.add.image_flip) {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.add.image_normal +
          '" card_flip="' +
          change.add.image_flip +
          '">' +
          change.add.name +
          '</a>';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.add.image_normal + '">' + change.add.name + '</a>';
      }
    } else if (change.remove) {
      val += '<span class="badge badge-danger">–</span> ';
      if (change.remove.image_flip) {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.remove.image_normal +
          '" card_flip="' +
          change.remove.image_flip +
          '">' +
          change.remove.name +
          '</a>';
      } else {
        val += '<a class="dynamic-autocard" card="' + change.remove.image_normal + '">' + change.remove.name + '</a>';
      }
    } else if (change.replace) {
      val += '<span class="badge badge-primary">→</span> ';
      if (change.replace[0].image_flip) {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.replace[0].image_normal +
          '" card_flip="' +
          change.replace[0].image_flip +
          '">' +
          change.replace[0].name +
          '</a> > ';
      } else {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.replace[0].image_normal +
          '">' +
          change.replace[0].name +
          '</a> > ';
      }
      if (change.replace[1].image_flip) {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.replace[1].image_normal +
          '" card_flip="' +
          change.replace[1].image_flip +
          '">' +
          change.replace[1].name +
          '</a>';
      } else {
        val +=
          '<a class="dynamic-autocard" card="' +
          change.replace[1].image_normal +
          '">' +
          change.replace[1].name +
          '</a>';
      }
    }
    val += '<br>';
  });

  changelist.innerHTML = val;

  autocard_init('dynamic-autocard');
  changes.forEach(function(change, index) {
    var clickx = document.getElementById('clickx' + index);
    clickx.addEventListener('click', function(e) {
      changes.splice(index, 1);
      updateCollapse();
    });
  });
}

function init_bulkconfirm() {
  var addedhidden = document.getElementById('addedcardshidden');
  var added = JSON.parse(addedhidden.value);
  added.forEach(function(add, index) {
    changes.push({
      add: add,
    });
  });
  updateCollapse();
}

var prev_handler = window.onload;
window.onload = function() {
  if (prev_handler) {
    prev_handler();
  }
  init_bulkconfirm();
};
