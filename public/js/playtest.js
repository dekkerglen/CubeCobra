

$('#startDraftButton').click(function(e){
  e.preventDefault();
  $('#fireDraftHidden').val(JSON.stringify({
    packs:$('#newDraftPacks').val(),
    cards:$('#newDraftCards').val(),
    seats:$('#newDraftSeats').val(),
    id:-1
  }));
  $('#fireDraftForm').submit();
});

$('.start-custom-draft').click(function(e){
  e.preventDefault();
  console.log('fire custom draft: ');
  $('#fireDraftHidden').val(JSON.stringify({
    seats:$('#customDraftSeats'+e.target.getAttribute('data-draft')).val(),
    id:e.target.getAttribute('data-draft')
  }));
  $('#fireDraftForm').submit();
});

$('#sampleSeedValue').keyup(function(e){
  const cubeId = $('#viewSeededButton').attr('data-cube-id');
  const seed = $(this).val();
  $('#viewSeededButton').attr('href', `/cube/samplepack/${cubeId}/${seed}`);
});
