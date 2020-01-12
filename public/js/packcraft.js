var cardTemplate =
  '<div class="input-group mb-3">' +
  '<div class="input-group-prepend"><span class="input-group-text">#{label}</span></div>' +
  '<input type="text" class="form-control card-input" data-card="#{card}" data-pack="#{pack}" value="#{value}"></input>' +
  '<div class="input-group-append">' +
  '<button class="btn btn-outline-secondary remove-card" data-card="#{card}" data-pack="#{pack}" type="button">Remove</button>' +
  '</div>' +
  '</div>';

var format = [];

var cube = JSON.parse(document.getElementById('cuberaw').value);

$('#customDraftButton').click(function(e) {
  e.preventDefault();
  format = [['rarity:Mythic', 'tag:New', 'identity>1']];
  $('#customDraftTitle').val('New Custom Format');
  $('#editor').html('');
  $('#customDraftHiddenId').val(-1);
  drawFormat();
  $('#customDraftModal').modal('show');
});

$('#AddPackButton').click(function(e) {
  e.preventDefault();
  format.push(['']);
  drawFormat();
});

function drawFormat() {
  var html = '';
  format.forEach(function(pack, index) {
    //card header
    html += '<div class="card"><div class="card-header">';
    html +=
      '<button class="close remove-pack"  type="button"><span data-id=' +
      index +
      ' aria-hidden="true">×</span></button>';
    if (pack.length == 1) {
      html += 'Pack ' + (index + 1) + ' - ' + pack.length + ' card</div>';
    } else {
      html += 'Pack ' + (index + 1) + ' - ' + pack.length + ' cards</div>';
    }

    //card body
    html += '<div class="card-body">';
    var packhtml = '';
    pack.forEach(function(card, card_index) {
      var pickhtml = cardTemplate;
      pickhtml = replaceAll(pickhtml, '#{label}', card_index + 1);
      pickhtml = replaceAll(pickhtml, '#{card}', card_index);
      pickhtml = replaceAll(pickhtml, '#{pack}', index);
      pickhtml = replaceAll(pickhtml, '#{value}', card);
      packhtml += pickhtml;
    });
    html += packhtml;

    //footer
    html += '</div><div class="card-footer">';
    html += '<button type="button" class="btn btn-success add-card" data-pack="' + index + '">Add Card Slot</button>';
    html +=
      '<a>  </a><button type="button" class="btn btn-success duplicate-pack" data-pack="' +
      index +
      '">Duplicate Pack</button>';

    html += '</div></div></br>';
  });

  $('#customDraftBody').html(html);
  $('.remove-pack').click(function(e) {
    e.preventDefault();
    format.splice(e.target.getAttribute('data-id'), 1);
    drawFormat();
  });
  $('.duplicate-pack').click(function(e) {
    e.preventDefault();
    var pack = [];
    format[e.target.getAttribute('data-pack')].forEach(function(card, card_index) {
      pack.push(card);
    });
    format.splice(e.target.getAttribute('data-pack'), 0, pack);
    drawFormat();
  });
  $('.remove-card').click(function(e) {
    e.preventDefault();
    format[e.target.getAttribute('data-pack')].splice(e.target.getAttribute('data-card'), 1);
    drawFormat();
  });
  $('.add-card').click(function(e) {
    e.preventDefault();
    format[e.target.getAttribute('data-pack')].push('');
    drawFormat();
  });
  $('.card-input').change(function(e) {
    e.preventDefault();
    console.log($(this).val());
    format[e.target.getAttribute('data-pack')][e.target.getAttribute('data-card')] = $(this).val();
  });
}

function replaceAll(str, original, replacement) {
  var res = str;
  while (res.includes(original)) {
    res = res.replace(original, replacement);
  }
  return res;
}

$('#customDraftForm').submit(function(e) {
  e.preventDefault();
  var form = this;
  $('#customDraftHiddenHTML').val($('#editor').html());
  $('#customDraftHidden').val(JSON.stringify(format));
  form.submit();
});

$('.editFormatButton').click(function(e) {
  e.preventDefault();
  format = JSON.parse(cube.draft_formats[e.target.getAttribute('data-id')].packs);
  $('#customDraftTitle').val(cube.draft_formats[e.target.getAttribute('data-id')].title);
  $('#editor').html(cube.draft_formats[e.target.getAttribute('data-id')].html);
  $('#customDraftFormRadioFalse').prop('checked', !cube.draft_formats[e.target.getAttribute('data-id')].multiples);
  $('#customDraftFormRadioTrue').prop('checked', cube.draft_formats[e.target.getAttribute('data-id')].multiples);
  $('#customDraftHiddenId').val(e.target.getAttribute('data-id'));
  drawFormat();
  $('#customDraftModal').modal('show');
});
