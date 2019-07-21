
$("#postBlogForm").submit(function(e){
    e.preventDefault();
    var form = this;
    $('#postBlogHiddenHTML').val($('#editor').html());
    form.submit();
});

$(".editBlogButton").click(function(e){
    e.preventDefault();
    const id = $(this).attr('data-id');

    fetch("/cube/blogsrc/"+id, {
      method: "GET",
      headers:{
        'Content-Type': 'application/json'
      }
    }).then(response => response.json()).then(function(json)
    {
      if(json.src)
      {
        $('#editor').html(json.src);
      }
      else
      {
        $('#editor').html(json.body);
      }

      $('#postBlogTitleInput').val(json.title);
      $('#postBlogHiddenId').val(id);    
      $('#blogEditTitle').text('Edit Blog Post');
      $('#editBlogModal').modal('show');
      autocard_init_class('autocard');
    });
});

$(".newBlogButton").click(function(e){
    e.preventDefault();
    $('#editor').html('');
    $('#postBlogTitleInput').val('');
    $('#postBlogHiddenId').val('');
    $('#blogEditTitle').text('New Blog Post');
    $('#editBlogModal').modal('show');
});
