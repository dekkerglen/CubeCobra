function adjustDisplayImage(card, customImagesEnabled) {
  if (customImagesEnabled) {
    display_image = card.imgUrl !== undefined ? card.imgUrl : card.details.image_normal;
  } else {
    display_image = card.details.image_normal;
  }
  card.details.display_image = display_image;
}
