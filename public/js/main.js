$(document).ready(function() {
  $('.login-link').on('click', function(e) {
    e.preventDefault();
    $('#loginModal').modal('show');
  });
  $('.delete-cube').on('click', function(e) {
    $target = $(e.target);
    var id = $target.attr('data-id');
    $.ajax({
      type: 'DELETE',
      url: '/cube/remove/' + id,
      success: function() {
        window.location.href = '/';
      },
      error: function(err) {
        console.log(err)
      }
    });
  })
  $('.delete-blog').on('click', function(e) {
    $target = $(e.target);
    var id = $target.attr('data-id');
    $.ajax({
      type: 'DELETE',
      url: '/cube/blog/remove/' + id,
      success: function() {
        window.location.href = '';
      },
      error: function(err) {
        console.log(err)
      }
    });
  })
  $('.delete-format').on('click', function(e) {
    $target = $(e.target);
    var id = $target.attr('data-id');
    var cube = $target.attr('data-cube');
    $.ajax({
      type: 'DELETE',
      url: '/cube/format/remove/' + cube + ';' + id,
      success: function() {
        window.location.href = '';
      },
      error: function(err) {
        console.log(err)
      }
    });
  })
});

function ISODateToYYYYMMDD(dateString) {
  const locale = "en-US";

  if (dateString === undefined) {
    return undefined;
  }

  return new Date(dateString).toLocaleDateString(locale);
}

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