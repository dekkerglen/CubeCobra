import React, { useCallback, useEffect, useRef, useState } from 'react';

import { cardFinish, cardTags } from 'utils/cardutil';

import Card from '../../datatypes/Card';
import { TagColor } from '../../datatypes/Cube';
import { Flexbox } from '../components/base/Layout';
import Tag from '../components/base/Tag';
import { getTagColorClass } from '../utils/Util';

interface Tag {
  value: string;
  colorClass: string;
}

interface CardDivProps {
  hidden: boolean;
  front: string | null;
  back: string | null;
  tags: Tag[];
  zIndex: number;
  foilOverlay: boolean;
}

type Position = { left?: string; right?: string; top?: string; bottom?: string };

const CardDiv: React.FC<CardDivProps> = ({ hidden, front, back, tags, zIndex, foilOverlay }) => {
  const [position, setPosition] = useState<Position>({ left: '0px', right: '0px' });
  const autocardPopup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.onmousemove = (e) => {
      const leftPixelSpace = e.clientX;
      const rightPixelSpace = window.innerWidth - leftPixelSpace;
      const topPixelSpace = e.clientY;
      const bottomPixelSpace = window.innerHeight - topPixelSpace;

      const xOffset = e.clientX + window.pageXOffset;
      const yOffset = e.clientY + window.pageYOffset;

      const newPosition: Position = {};

      if (rightPixelSpace > leftPixelSpace) {
        // display on right
        newPosition.left = `${Math.max(window.pageXOffset, 5 + xOffset)}px`;
        // newPosition.right = null;
      } else {
        // display on left
        newPosition.right = `${Math.max(window.innerWidth + 5 - xOffset, 0)}px`;
        // newPosition.left = null;
      }
      if (autocardPopup.current!.offsetHeight > window.innerHeight) {
        newPosition.top = `${window.pageYOffset}px`;
        // newPosition.bottom = null;
      } else if (bottomPixelSpace > topPixelSpace) {
        // display on bottom
        newPosition.top = `${5 + yOffset}px`;
        // newPosition.bottom = null;
      } else {
        // display on top
        newPosition.bottom = `${window.innerHeight + 5 - yOffset}px`;
        // newPosition.top = null;
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
      <div className="autocard-background bg-bg-accent">
        <Flexbox direction="row">
          {front && (
            <div className="col position-relative card-border">
              {foilOverlay && <img className="foilOverlay" src="/content/foilOverlay.png" alt="foil overlay" />}
              <img className="rounded-b-md" id="autocardImageFront" src={front} alt={front} key={front} />
            </div>
          )}
          {back && (
            <div className="col position-relative card-border">
              {foilOverlay && <img className="foilOverlay" src="/content/foilOverlay.png" alt="foil overlay" />}
              <img className="rounded-b-md" id="autocardImageBack" src={back} alt={back} key={back} />
            </div>
          )}
        </Flexbox>
        {tags.length > 0 && (
          <div className="row g-0 p-1" id="autocardTags">
            {tags.map((tag) => (
              <Tag key={tag.value} text={tag.value} colorClass={tag.colorClass} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export interface AutocardContextValue {
  showCard: (card: any, inModal: boolean, showCustomImages: boolean, tagColors: TagColor[]) => void;
  hideCard: () => void;
  stopAutocard: boolean;
  setStopAutocard: React.Dispatch<React.SetStateAction<boolean>>;
}

const AutocardContext = React.createContext<AutocardContextValue>({
  showCard: () => {},
  hideCard: () => {},
  stopAutocard: false,
  setStopAutocard: () => {},
});

export const AutocardContextProvider: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const [hidden, setHidden] = useState(true);
  const [foilOverlay, setFoilOverlay] = useState(false);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [stopAutocard, setStopAutocard] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [zIndex, setZIndex] = useState(500);

  const showCard = useCallback(
    (card: Card, inModal: boolean, showCustomImages: boolean, tagColors: TagColor[]) => {
      if (!stopAutocard) {
        setHidden(false);
        setFoilOverlay(cardFinish(card) === 'Foil');
        setFront(((showCustomImages && card.imgUrl) || card.details?.image_normal) ?? null);
        setBack(((showCustomImages && card.imgBackUrl) || card.details?.image_flip) ?? null);
        setTags(
          cardTags(card).map((tag) => ({
            value: tag,
            colorClass: getTagColorClass(tagColors, tag),
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

  const value: AutocardContextValue = {
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
};

export default AutocardContext;
