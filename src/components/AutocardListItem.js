import React, { useCallback, useContext } from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import TagContext from './TagContext';
import { getCardColorClass } from './TagContext';
import withAutocard from './WithAutocard';

import Affiliate from '../utils/Affiliate';

const AutocardDiv = withAutocard('li');

const AutocardListItem = ({ card, noCardModal, inModal, className, children }) => {
  const { name } = card.details;
  const { getTagColorStyle } = useContext(TagContext);
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback(
    (event) => {
      event.preventDefault();
      openCardModal(card);
    },
    [card, openCardModal],
  );
  const handleAuxClick = useCallback(
    (event) => {
      if (event.button == 1) {
        event.preventDefault();
        window.open('/tool/card/' + card.details._id);
      }
    },
    [card.details._id],
  );
  return (
    <AutocardDiv
      className={`card-list-item list-group-item ${getCardColorClass(card)} ${className || ''}`}
      style={getTagColorStyle(card.tags)}
      card={card}
      onAuxClick={noCardModal ? undefined : handleAuxClick}
      onClick={noCardModal ? undefined : handleClick}
      inModal={inModal}
      role="button"
    >
      {name}
      {children}
    </AutocardDiv>
  );
};

export default AutocardListItem;
