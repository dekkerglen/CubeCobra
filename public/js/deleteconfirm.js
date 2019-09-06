$("#confirmation").keyup(function(){
    if ($(this).val().toLowerCase() == 'delete'){
        $("#delete").removeAttr('disabled');
    } else {
        $("#delete").attr('disabled', 'disabled')   
    }
})