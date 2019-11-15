function updateBlog() {
  $("#postBlogForm").submit(function(e) {
    e.preventDefault();
    var form = this;
    $('.postBlogHiddenHTML').val($('#editor').html());
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

}

updateBlog();