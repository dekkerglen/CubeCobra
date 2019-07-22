
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

  var res = '<div class="row even-cols">';
  Object.keys(columns).forEach(function(column_label, col_index)
  {
    var column = columns[column_label];

    if(Object.keys(column).length > 0)
    {
      res += '<div class="col-even" style="width: '+colWidth+'%;">'
      res += '<h6>'+column_label+ ' ('+ columnLength(sorts[0],column_label) + ')</h6>';

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

          res += '<ul class="list-group" style="padding:5px 0px;">';
          res += '<a '
          if(groupModalFields.submit)
          {
            res += 'href="#"'
          }
          res += 'class="activateGroupContextModal list-group-item list-group-heading" primarysort="'+column_label+'" secondarysort="'+rowgroup_label+'">' + rowgroup_label +' ('+ rowgroup.length + ')</a>';

          rowgroup.forEach(function( card, index)
          {
            if(card.details.image_flip)
            {
              res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'" card_flip="' + card.details.image_flip +'">';
            }
            else
            {
              res += '<a href="#" cardIndex="'+card.index+'" class="activateContextModal card-list-item list-group-item autocard ' + getCardColorClass(card) + '" card="' + card.details.image_normal +'">';
            }
            res += card.details.name+'</a>';
          });

          res += '</ul">';
      });

      res += '</div>';
    }
  });

  res += '</div>';
  cubeArea.innerHTML = res;

  autocard_init_class('autocard');
  init_contextModal();
  if(groupModalFields.submit)
  {
    init_groupcontextModal();
  }
}
