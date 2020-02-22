var stopAutocard = false;
var autocardTimeout = null;

window.globalTagColors = window.globalTagColors || [];
window.globalShowTagColors = window.globalShowTagColors !== false;

function getTagColorClass(tag) {
  const tagColor = window.globalTagColors.find((tagColor) => tag === tagColor.tag);
  if (window.globalShowTagColors && tagColor && tagColor.color) {
    return `tag-color tag-${tagColor.color}`;
  } else {
    return 'tag-no-color';
  }
}

function getElementPosition(el) {
  var l = 0,
    t = 0;
  while (el.offsetParent) {
    l += el.offsetLeft;
    t += el.offsetTop;
    el = el.offsetParent;
  }
  return {
    left: l,
    top: t,
  };
}

const autocardEnterListeners = new Map();
const autocardLeaveListeners = new Map();
function autocard_init(classname) {
  const elements = document.getElementsByClassName(classname);
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    const enterListener = autocardEnterListeners.get(element);
    if (enterListener) {
      element.removeEventListener('mouseenter', enterListener);
    }
    autocardEnterListeners.set(
      element,
      element.addEventListener('mouseenter', (event) => {
        if (!stopAutocard) {
          const target = event.target;
          let tagsStr = target.getAttribute('card_tags');
          let tags = tagsStr ? tagsStr.split(',') : null;
          let foil = target.getAttribute('data-foil') === 'true';
          autocard_show_card(
            target.getAttribute('card'),
            target.getAttribute('card_flip'),
            target.classList.contains('autocard-art-crop'),
            tags,
            foil,
          );
        }
      }),
    );

    const leaveListener = autocardLeaveListeners.get(element);
    if (leaveListener) {
      element.removeEventListener('mouseleave', leaveListener);
    }
    autocardLeaveListeners.set(element, element.addEventListener('mouseleave', () => autocard_hide_card()));
  }
}

document.onmousemove = function(e) {
  popupElement = document.getElementById('autocardPopup');

  var leftPixelSpace = e.clientX;
  var rightPixelSpace = window.innerWidth - leftPixelSpace;
  var topPixelSpace = e.clientY;
  var bottomPixelSpace = window.innerHeight - topPixelSpace;

  var x_offset = e.clientX + self.pageXOffset;
  var y_offset = e.clientY + self.pageYOffset;

  if (rightPixelSpace > leftPixelSpace) {
    // display on right
    autocardPopup.style.left = 5 + x_offset + 'px';
    autocardPopup.style.right = null;
  } else {
    // display on left
    autocardPopup.style.right = window.innerWidth + 5 - x_offset + 'px';
    autocardPopup.style.left = null;
  }
  if (bottomPixelSpace > topPixelSpace) {
    // display on bottom
    autocardPopup.style.top = 5 + y_offset + 'px';
    autocardPopup.style.bottom = null;
  } else {
    // display on top
    autocardPopup.style.bottom = window.innerHeight + 5 - y_offset + 'px';
    autocardPopup.style.top = null;
  }
};

const autocardLoadListeners = {};
function autocard_show_card(card_image, card_flip, show_art_crop, tags, foil, in_modal) {
  const popup = document.getElementById('autocardPopup');
  const popupImg = document.getElementById('autocardImageFront');
  const popupImgBack = document.getElementById('autocardImageBack');

  const overlays = popup.getElementsByClassName('foilOverlay');
  for (let i = 0; i < overlays.length; i++) {
    if (foil) {
      overlays[i].classList.remove('d-none');
    } else {
      overlays[i].classList.add('d-none');
    }
  }

  popupImg.setAttribute('src', card_image);
  if (card_flip) {
    popupImgBack.setAttribute('src', card_flip);
    popupImgBack.classList.remove('d-none');
  } else {
    popupImgBack.removeAttribute('src');
    popupImgBack.classList.add('d-none');
  }

  const popupTags = document.getElementById('autocardTags');
  if (tags) {
    popupTags.classList.remove('d-none');
  } else {
    popupTags.classList.add('d-none');
  }

  popup.style.zIndex = in_modal ? 1500 : 500;

  if (tags) {
    let tagsText = '<div class="autocard-tags">';
    tags.forEach(function(tag, index) {
      tagsText += "<span class='tag " + getTagColorClass(tag.trim()) + "'>" + tag.trim() + '</span>';
    });
    tagsText += '</div>';
    document.getElementById('autocardTags').innerHTML = tagsText;
  }

  // only show the three autocard divs once the images are done loading
  autocardLoadListeners[popupImg.id] = popupImg.addEventListener('load', () => {
    if (card_flip && !popupImgBack.complete) {
      return;
    }
    // only fill in tags area once the image is done loading
    if (autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
    autocardTimeout = setTimeout(() => document.getElementById('autocardPopup').classList.remove('d-none'), 50);
  });
  if (card_flip) {
    autocardLoadListeners[popupImgBack.id] = popupImgBack.addEventListener('load', () => {
      if (!popupImg.complete) {
        return;
      }
      // only fill in tags area once the image is done loading
      if (autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
      autocardTimeout = setTimeout(() => document.getElementById('autocardPopup').classList.remove('d-none'), 50);
    });
  }
  if (popupImg.complete && (!card_flip || popupImgBack.complete)) {
    // cached workaround
    if (autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
    autocardTimeout = setTimeout(() => document.getElementById('autocardPopup').classList.remove('d-none'), 50);
  }
}

function autocard_hide_card() {
  // clear any load events that haven't fired yet so that they don't fire after the card should be hidden
  if (autocardTimeout) autocardTimeout = clearTimeout(autocardTimeout);
  for (const id in autocardLoadListeners) {
    const img = document.getElementById(id);
    const listener = autocardLoadListeners[img];
    img.removeEventListener('load', listener);
    delete autocardLoadListeners[img];
  }

  document.getElementById('autocardPopup').classList.add('d-none');
}
