import React, { useCallback, useContext, useMemo } from 'react';

import cx from 'classnames';
import emojiRegex from 'emoji-regex';

import DisplayContext from 'contexts/DisplayContext';
import RotoDraftContext from 'contexts/RotoDraftContext';
import { cardName, getCardTagColorClass } from '@utils/cardutil';

import Card from '@utils/datatypes/Card';
import TagColorContext from '../../contexts/TagColorContext';
import UserContext from '../../contexts/UserContext';
import { ListGroupItem } from '../base/ListGroup';
import withAutocard from '../WithAutocard';

export interface AutocardListItemProps {
  card: Card;
  noCardModal?: boolean;
  inModal?: boolean;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  last?: boolean;
  first?: boolean;
  className?: string;
  isSelected?: boolean;
  showRotoInfo?: boolean;
  cardCopyIndex?: number; // Index for this copy of the card (1-based)
}

const AutocardDiv = withAutocard(ListGroupItem);

const CARD_NAME_FALLBACK = 'Unidentified Card';
const CARD_ID_FALLBACK = 'undefined';

const noOp = () => undefined;

const AutocardListItem: React.FC<AutocardListItemProps> = ({
  card,
  noCardModal = false,
  inModal = false,
  children,
  onClick,
  last,
  first,
  className,
  isSelected = false,
  showRotoInfo = false,
  cardCopyIndex = 1,
}) => {
  const tagColors = useContext(TagColorContext);
  const user = useContext(UserContext);
  const { showInlineTagEmojis } = useContext(DisplayContext);
  const [name, cardId] = useMemo(
    () => (card && card.details ? [cardName(card), card.details.scryfall_id] : [CARD_NAME_FALLBACK, CARD_ID_FALLBACK]),
    [card],
  );
  const { url: rotoUrl, getPickByNameAndIndex } = useContext(RotoDraftContext);

  const openCardToolWindow = useCallback(() => {
    window.open(`/tool/card/${cardId}`);
  }, [cardId]);

  const handleAuxClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault();
        openCardToolWindow();
      }
    },
    [openCardToolWindow],
  );

  const colorClassname = useMemo(() => {
    if (user && user.hideTagColors) {
      return getCardTagColorClass([], card);
    }
    return getCardTagColorClass(tagColors, card);
  }, [card, tagColors, user]);

  const findEmojisInTags = (tags: string[]): string[] => {
    const regex = emojiRegex();
    const emojis: string[] = [];

    for (const tag of tags) {
      const emojisInTag = tag.match(regex);
      if (emojisInTag) {
        emojis.push(...emojisInTag);
      }
    }

    return [...new Set(emojis)];
  };

  const emojiTags = useMemo(() => (card && card.tags ? findEmojisInTags(card.tags) : []), [card]);

  const rotoPickInfo = React.useMemo(() => {
    return showRotoInfo && rotoUrl !== '' ? getPickByNameAndIndex(name, cardCopyIndex) : undefined;
  }, [name, showRotoInfo, rotoUrl, getPickByNameAndIndex, cardCopyIndex]);

  return (
    <AutocardDiv
      className={cx(`flex justify-between bg-card-${colorClassname}`, { 'font-bold': isSelected }, className)}
      card={card}
      onAuxClick={noCardModal ? noOp : handleAuxClick}
      inModal={inModal}
      onClick={onClick}
      last={last}
      first={first}
    >
      {children ? (
        <span>
          {children} <span>{name}</span>
        </span>
      ) : (
        <span style={rotoPickInfo && { textDecoration: 'line-through', fontStyle: 'italic' }}>{name}</span>
      )}
      {rotoPickInfo && <span className="text-right">{rotoPickInfo.playerName}</span>}
      {showInlineTagEmojis ? <span className="text-right">{emojiTags.join('')}</span> : ''}
    </AutocardDiv>
  );
};

export default AutocardListItem;
