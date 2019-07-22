
function updateCubeList()
{
  sorts[0] = document.getElementById('primarySortSelect').value;
  sorts[1] = document.getElementById('secondarySortSelect').value;
  columns = sortIntoGroups(filteredCube(), sorts[0]);
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    columns[column_label] = sortIntoGroups(columns[column_label],sorts[1]);
  });

  var count = 0;

   Object.keys(columns).forEach(function(col, index)
   {
     if(Object.keys(columns[col]).length > 0)
     {
       count += 1;
     }
   });

  var colWidth = Math.max(10,100.0 / count);

  var res = '<div class="row no-gutters"><div class="col">';
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    var column = columns[column_label];

    if(Object.keys(column).length > 0)
    {
      //res += '<h6>'+column_label+ ' ('+ columnLength(sorts[0],column_label) + ')</h6>';

      Object.keys(column).forEach(function(rowgroup_label, rowgroup_index)
      {
        var rowgroup = column[rowgroup_label];
        rowgroup.sort(function(x, y)
        {
          if (x.cmc < y.cmc)
          {
            return -1;
          }
          if (x.cmc > y.cmc)
          {
            return 1;
          }
          if (x.details.name < y.details.name)
          {
            return -1;
          }
          if (x.details.name > y.details.name)
          {
            return 1;
          }
          return 0;
        });

        rowgroup.forEach(function( card, index)
        {
          if(card.details.image_flip)
          {
            res += '<a href="#" class="autocard" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
          }
          else
          {
            res += '<a href="#" class="autocard" card="' + card.details.image_normal +'">';
          }
          res += '<img cardIndex="'+card.index+'" class="activateContextModal" src="'+card.details.image_normal+'" alt="'+card.details.name+'" width=150 height=210>';
          res += '</a>';
        });
      });

    }
  });

  res += '</div></div>';
  cubeArea.innerHTML = res;
  autocard_init_class('autocard');
  init_contextModal();
  if(groupModalFields.submit)
  {
    init_groupcontextModal();
  }
}
