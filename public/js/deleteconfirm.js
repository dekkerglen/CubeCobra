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
