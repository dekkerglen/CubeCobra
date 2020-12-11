import React, { useCallback, useContext, useMemo } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import CardModalContext from 'contexts/CardModalContext';
import TagContext from 'contexts/TagContext';
import withAutocard from 'components/WithAutocard';

const AutocardDiv = withAutocard('li');

const CARD_NAME_FALLBACK = 'Unidentified Card';
const CARD_ID_FALLBACK = 'undefined';

/** 2020-11-18 struesdell:
 *  Added noOp callback to allow props to fall through without passing undefined to children.
 */
const noOp = () => undefined;

/** 2020-11-18 struesdell:
 *  Pulled out className constants for maintainability
 */
const styles = {
  root: 'card-list-item list-group-item',
  name: 'card-list-item_name',
  children: 'card-list-item_children',
};

const AutocardListItem = ({ card, noCardModal, inModal, className, children }) => {
  const { cardColorClass } = useContext(TagContext);
  const openCardModal = useContext(CardModalContext);

  /** 2020-11-18 struesdell:
   *  Replaced destructuring with `useMemo` tuple to minimize rerenders
   */
  const [cardName, cardId] = useMemo(
    () => (card && card.details ? [card.details.name, card.details._id] : [CARD_NAME_FALLBACK, CARD_ID_FALLBACK]),
    [card],
  );

  const openCardToolWindow = useCallback(() => {
    window.open(`/tool/card/${cardId}`);
  }, [cardId]);

  const handleClick = useCallback(
    (event) => {
      event.preventDefault();
      if (event.ctrlKey) {
        openCardToolWindow();
      } else {
        openCardModal(card);
      }
    },
    [card, openCardModal, openCardToolWindow],
  );

  const handleAuxClick = useCallback(
    (event) => {
      if (event.button === 1) {
        event.preventDefault();
        openCardToolWindow();
      }
    },
    [openCardToolWindow],
  );

  /** 2020-11-18 struesdell:
   *  Memoized card color (WUBRG) derivation to minimize rerenders
   *  @note: tag coloring is handled by AutocardDiv automatically.
   */
  const colorClassname = useMemo(() => cardColorClass(card), [card, cardColorClass]);

  return (
    <AutocardDiv
      className={cx(styles.root, colorClassname, className)}
      card={card}
      onAuxClick={noCardModal ? noOp : handleAuxClick}
      onClick={noCardModal ? noOp : handleClick}
      inModal={inModal}
      role="button"
    >
      <span className={styles.name}>{cardName}</span>
      <span className={styles.children}>{children}</span>
    </AutocardDiv>
  );
};
AutocardListItem.propTypes = {
  card: CardPropType.isRequired,
  noCardModal: PropTypes.bool,
  inModal: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
AutocardListItem.defaultProps = {
  noCardModal: false,
  inModal: false,
  className: '',
  children: undefined,
};

export default AutocardListItem;
