$(document).ready(function()
{
  $('.delete-cube').on('click', function(e)
  {
    $target = $(e.target);
    const id = $target.attr('data-id');
    $.ajax({
      type:'DELETE',
      url:'/cube/remove/'+id,
      success: function(){
        window.location.href='/';
      },
      error: function(err){
        console.log(err)
      }
    });
  })
});
