function updateBlog() {
  $("#postBlogForm").submit(function(e) {
    e.preventDefault();
    var form = this;
    $('#postBlogHiddenHTML').val($('#editor').html());
    form.submit();
  });

  $(".editBlogButton").click(function(e) {
    console.log("btn press");
    e.preventDefault();
    const id = $(this).attr('data-id');

    fetch("/cube/blogsrc/" + id)
      .then(response => response.json())
      .then(function(json) {
        if (json.src) {
          $('#editor').html(json.src);
        } else {
          $('#editor').html(json.body);
        }

        $('#postBlogTitleInput').val(json.title);
        $('#postBlogHiddenId').val(id);
        $('#blogEditTitle').text('Edit Blog Post');
        $('#editBlogModal').modal('show');
        autocard_init('autocard');
      });
  });

  $(".newBlogButton").click(function(e) {
    e.preventDefault();
    $('#editor').html('');
    $('#postBlogTitleInput').val('');
    $('#postBlogHiddenId').val('');
    $('#blogEditTitle').text('New Blog Post');
    $('#editBlogModal').modal('show');
  });

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
  });

  //$('.collapse').collapse();
}

updateBlog();