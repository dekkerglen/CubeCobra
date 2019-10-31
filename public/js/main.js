$(document).ready(function() {
  $('.login-link').on('click', function(e) {
    e.preventDefault();
    $('#loginModal').modal('show');
  });
  $('.delete-cube').on('click', function(e) {
    $target = $(e.target);
    var id = $target.attr('data-id');
    csrfFetch('/cube/remove/' + id, {
      method: 'DELETE',
      headers: {}
    }).then(response => {
      if (!response.ok) {
        console.log(response);
      } else {
        window.location.href = '';
      }
    });
  })
  $('.delete-format').on('click', function(e) {
    $target = $(e.target);
    var id = $target.attr('data-id');
    var cube = $target.attr('data-cube');
    csrfFetch('/cube/format/remove/' + cube + ';' + id, {
      method: 'DELETE',
      headers: {}
    }).then(response => {
      if (!response.ok) {
        console.log(response);
      } else {
        window.location.href = '';
      }
    });
  });
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