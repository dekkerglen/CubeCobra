$('#clearNotifications').on('click', function(e) {
  e.preventDefault();
  csrfFetch('/user/clearnotifications', {
    method: 'POST',
  }).then((response) => {
    if (!response.ok) {
      console.error(response);
    } else {
      $('#notificationsBadge').remove();
      $('#noNotifcations').removeClass('d-none');
    }
  });
});
