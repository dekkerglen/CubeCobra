$('#confirmation').keyup(function() {
  if (
    $(this)
      .val()
      .toLowerCase() == 'delete'
  ) {
    $('.delete-cube').removeAttr('disabled');
  } else {
    $('.delete-cube').attr('disabled', 'disabled');
  }
});
$('.delete-cube').on('click', function(e) {
  $target = $(e.target);
  var id = $target.attr('data-id');
  csrfFetch('/cube/remove/' + id, {
    method: 'DELETE',
    headers: {},
  }).then((response) => {
    if (!response.ok) {
      console.log(response);
    } else {
      window.location.href = '';
    }
  });
});
