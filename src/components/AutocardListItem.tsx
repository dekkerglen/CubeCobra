import React, { useCallback, useContext, useMemo } from 'react';

import cx from 'classnames';

import withAutocard from 'components/WithAutocard';
import TagColorContext from 'contexts/TagColorContext';
import UserContext from 'contexts/UserContext';
import Card from 'datatypes/Card';
import { getCardTagColorClass } from 'utils/Util';

export interface AutocardListItemProps {
  card: Card;
  noCardModal?: boolean;
  inModal?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const AutocardDiv = withAutocard('li');

const CARD_NAME_FALLBACK = 'Unidentified Card';
const CARD_ID_FALLBACK = 'undefined';

const noOp = () => undefined;

const styles = {
  root: 'card-list-item list-group-item',
  name: 'card-list-item_name',
  children: 'card-list-item_children',
};

const AutocardListItem: React.FC<AutocardListItemProps> = ({
  card,
  noCardModal = false,
  inModal = false,
  className = '',
  children,
  ...props
}) => {
  const tagColors = useContext(TagColorContext);
  const user = useContext(UserContext);
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

  return (
    <AutocardDiv
      className={cx(styles.root, colorClassname, className)}
      card={card}
      onAuxClick={noCardModal ? noOp : handleAuxClick}
      inModal={inModal}
      role="button"
      {...props}
    >
      <span className={styles.children}>{children}</span>
      <span className={styles.name}>{cardName}</span>
    </AutocardDiv>
  );
};

export default AutocardListItem;
