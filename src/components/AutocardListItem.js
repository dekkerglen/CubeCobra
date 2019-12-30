import React, { useCallback, useContext } from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import TagContext from './TagContext';
import withAutocard from './WithAutocard';

import Affiliate from '../util/Affiliate';

const AutocardDiv = withAutocard('div');

const AutocardListItem = ({ card, noCardModal, children }) => {
  const { name } = card.details;
  const { cardColorClass } = useContext(TagContext);
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback((event) => {
    event.preventDefault();
    openCardModal(card.index);
  }, [card.index, openCardModal]);
  const handleAuxClick = useCallback((event) => {
    if (event.button == 1) {
      event.preventDefault();
      window.open('/tool/card/' + card.details._id);
    }
  }, [card.details._id]);
  return (
    <AutocardDiv
      className={`card-list-item list-group-item autocard d-flex flex-row ${cardColorClass(card)}`}
      card={card}
      onAuxClick={noCardModal ? undefined : handleAuxClick}
      onClick={noCardModal ? undefined : handleClick}
    >
      {name}
      {children}
    </AutocardDiv>
  );
};

export default AutocardListItem;
