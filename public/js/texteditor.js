$('.toolbar a').click(function(e) {
  e.preventDefault();
  var command = $(this).data('command');
  if (command == 'h5' || command == 'h6') {
    document.execCommand('formatBlock', false, command);
  }
  else if (command =='AC')
  {
    card = prompt('Enter the card name here: ', '');
    document.execCommand('insertHTML', false, "<a class='autocard', card='"+card+"'>"+card+"</a>");
    autocard_init('autocard');
  }
  else document.execCommand($(this).data('command'), false, null);
});
