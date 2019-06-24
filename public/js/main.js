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
  $('[data-toggle="tooltip"]').tooltip({
    animated: 'fade',
    placement: 'bottom',
    html: true
  });
});

function toggleRecent() {
  var x = document.getElementById("recentMore");
  if (x.innerHTML === "View More...") {
    x.innerHTML = "Hide";
  } else {
    x.innerHTML = "View More...";
  }
}
function toggleDraft() {
  var x = document.getElementById("draftMore");
  if (x.innerHTML === "View More...") {
    x.innerHTML = "Hide";
  } else {
    x.innerHTML = "View More...";
  }
}
