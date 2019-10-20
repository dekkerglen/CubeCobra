function updateBlog() {
  $("#postBlogForm").submit(function(e) {
    e.preventDefault();
    var form = this;
    $('#postBlogHiddenHTML').val($('#editor').html());
    form.submit();
  });

  $(".newBlogButton").click(function(e) {
    e.preventDefault();
    $('#editor').html('');
    $('#postBlogTitleInput').val('');
    $('#postBlogHiddenId').val('');
    $('#blogEditTitle').text('New Blog Post');
    $('#editBlogModal').modal('show');
  });

  $('.delete-blog').off().on('click', function(e) {
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
  });
}

updateBlog();