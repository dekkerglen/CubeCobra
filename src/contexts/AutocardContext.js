/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { cardFinish, cardTags } from 'utils/Card';

const AutocardContext = React.createContext({});

function CardDiv({ hidden, front, back, tags, zIndex, foilOverlay }) {
  const [position, setPosition] = useState({ left: 0, right: 0 });
  const autocardPopup = useRef(null);

  useEffect(() => {
    document.onmousemove = (e) => {
      const leftPixelSpace = e.clientX;
      const rightPixelSpace = window.innerWidth - leftPixelSpace;
      const topPixelSpace = e.clientY;
      const bottomPixelSpace = window.innerHeight - topPixelSpace;

      const xOffset = e.clientX + window.pageXOffset;
      const yOffset = e.clientY + window.pageYOffset;

      const newPosition = {};

      if (rightPixelSpace > leftPixelSpace) {
        // display on right
        newPosition.left = `${Math.max(window.pageXOffset, 5 + xOffset)}px`;
        newPosition.right = null;
      } else {
        // display on left
        newPosition.right = `${Math.max(window.innerWidth + 5 - xOffset, 0)}px`;
        newPosition.left = null;
      }
      if (autocardPopup.offsetHeight > window.innerHeight) {
        newPosition.top = `${window.pageYOffset}px`;
        newPosition.bottom = null;
      } else if (bottomPixelSpace > topPixelSpace) {
        // display on bottom
        newPosition.top = `${5 + yOffset}px`;
        newPosition.bottom = null;
      } else {
        // display on top
        newPosition.bottom = `${window.innerHeight + 5 - yOffset}px`;
        newPosition.top = null;
      }
      setPosition(newPosition);
    };
  }, []);

  return (
    <div
      className={(hidden ? `d-none ` : ' ') + (back ? 'double-width' : '')}
      id="autocardPopup"
      style={{ zIndex, ...position }}
      ref={autocardPopup}
    >
      <div className="autocard-background">
        <div className="row g-0">
          <div className="col position-relative card-border">
            {foilOverlay && <img className="foilOverlay" src="/content/foilOverlay.png" alt="foil overlay" />}
            <img id="autocardImageFront" src={front} alt={front} key={front} />
          </div>
          {back && (
            <div className="col position-relative card-border">
              {foilOverlay && <img className="foilOverlay" src="/content/foilOverlay.png" alt="foil overlay" />}
              <img id="autocardImageBack" src={back} alt={back} key={back} />
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="row g-0 p-1" id="autocardTags">
            {tags.map((tag) => (
              <span key={tag.value} className={`tag ${tag.colorClass}`}>
                {tag.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AutocardContextProvider({ children }) {
  const [hidden, setHidden] = useState(true);
  const [foilOverlay, setFoilOverlay] = useState(false);
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [stopAutocard, setStopAutocard] = useState(false);
  const [tags, setTags] = useState([]);
  const [zIndex, setZIndex] = useState(500);

  const showCard = useCallback(
    (card, inModal, showCustomImages) => {
      if (!stopAutocard) {
        setHidden(false);
        setFoilOverlay(cardFinish(card) === 'Foil');
        setFront((showCustomImages && card.imgUrl) || card.details.image_normal);
        setBack((showCustomImages && card.imgBackUrl) || card.details.image_flip);
        setTags(
          cardTags(card).map((tag) => ({
            value: tag,
            colorClass: '',
          })),
        );
        setZIndex(inModal ? 1500 : 500);
      }
    },
    [stopAutocard],
  );

  const hideCard = useCallback(() => {
    setHidden(true);
    setFoilOverlay(false);
    setFront(null);
    setBack(null);
    setTags([]);
  }, []);

  const value = {
    showCard,
    hideCard,
    stopAutocard,
    setStopAutocard,
  };

  return (
    <AutocardContext.Provider value={value}>
      {children}
      <CardDiv hidden={hidden} front={front} back={back} tags={tags} zIndex={zIndex} foilOverlay={foilOverlay} />
    </AutocardContext.Provider>
  );
}

AutocardContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AutocardContext;
