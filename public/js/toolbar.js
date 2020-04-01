document.getElementById('clearNotifications').addEventListener('click', (event) => {
  event.preventDefault();
  csrfFetch('/user/clearnotifications', {
    method: 'POST',
  }).then((response) => {
    if (!response.ok) {
      console.error(response);
    } else {
      document.getElementById('notificationsBadge').remove();
      document.getElementById('noNotifcations').classList.remove('d-none');
      const notifications = document.getElementsByClassName('user-notification');
      while (notifications[0]) {
        notifications[0].parentNode.removeChild(notifications[0]);
      }
    }
  });
});
