import React, { useCallback, useContext, useMemo } from 'react';

import cx from 'classnames';

import withAutocard from '../WithAutocard';
import TagColorContext from '../../contexts/TagColorContext';
import UserContext from '../../contexts/UserContext';
import Card from '../../../datatypes/Card';
import { getCardTagColorClass } from 'utils/Util';
import { ListGroupItem } from '../base/ListGroup';
import DisplayContext from 'contexts/DisplayContext';

export interface AutocardListItemProps {
  card: Card;
  noCardModal?: boolean;
  inModal?: boolean;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  last?: boolean;
  first?: boolean;
  className?: string;
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
}) => {
  const tagColors = useContext(TagColorContext);
  const user = useContext(UserContext);
  const { showInlineTagEmojis } = useContext(DisplayContext);
  const [cardName, cardId] = useMemo(
    () =>
      card && card.details ? [card.details.name, card.details.scryfall_id] : [CARD_NAME_FALLBACK, CARD_ID_FALLBACK],
    [card],
  );

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
    const emojiRegex = /\p{Emoji}/gu;
    const emojis: string[] = [];

    for (const tag of tags) {
      const matches = tag.match(emojiRegex);
      if (matches) {
        emojis.push(...matches);
      }
    }

    return emojis;
  };

  const emojiTags = useMemo(() => (card && card.tags ? findEmojisInTags(card.tags) : []), [card]);

  return (
    <AutocardDiv
      className={cx(`flex justify-between bg-card-${colorClassname} ${className}`)}
      card={card}
      onAuxClick={noCardModal ? noOp : handleAuxClick}
      inModal={inModal}
      onClick={onClick}
      last={last}
      first={first}
    >
      {children && <span>{children}</span>}
      <span>{cardName}</span>
      {showInlineTagEmojis ? <span className="text-right">{emojiTags.join('')}</span> : ''}
    </AutocardDiv>
  );
};

export default AutocardListItem;
