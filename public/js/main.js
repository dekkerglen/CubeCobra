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
  $('.delete-blog').on('click', function(e)
  {
    $target = $(e.target);
    const id = $target.attr('data-id');
    $.ajax({
      type:'DELETE',
      url:'/cube/blog/remove/'+id,
      success: function(){
        window.location.href='';
      },
      error: function(err){
        console.log(err)
      }
    });
  })
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
