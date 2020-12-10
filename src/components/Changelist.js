import React, { useCallback, useContext } from 'react';

import { Badge, Input } from 'reactstrap';

import ChangelistContext from 'contexts/ChangelistContext';
import withAutocard from './WithAutocard';

const TextAutocard = withAutocard('span');

const CloseButton = ({ changeId, close }) => (
  <a href="#" className="clickx" data-change-id={changeId} onClick={close}>
    ×
  </a>
);

const Add = ({ card, changeId, close }) => (
  <li>
    <CloseButton changeId={changeId} close={close} /> <Badge color="success">+</Badge>{' '}
    <TextAutocard card={card}>{card.details.name}</TextAutocard>
  </li>
);

const Remove = ({ card, changeId, close }) => (
  <li>
    <CloseButton changeId={changeId} close={close} /> <Badge color="danger">-</Badge>{' '}
    <TextAutocard card={card}>{card.details.name}</TextAutocard>
  </li>
);

const Replace = ({ cards, changeId, close }) => (
  <li>
    <CloseButton changeId={changeId} close={close} /> <Badge color="primary">→</Badge>{' '}
    <TextAutocard card={cards[0]}>{cards[0].details.name}</TextAutocard>
    {' > '}
    <TextAutocard card={cards[1]}>{cards[1].details.name}</TextAutocard>
  </li>
);

const Changelist = () => {
  const { changes, removeChange } = useContext(ChangelistContext);
  const close = useCallback(
    (event) => {
      event.preventDefault();

      const target = event.target;
      const changeId = parseInt(target.getAttribute('data-change-id'));
      removeChange(changeId);
    },
    [removeChange],
  );

  const getId = (card) => card.details._id || card.cardID;

  const changelistData = changes
    .map((change) => {
      if (change.add) {
        return '+' + (change.add.details._id || change.add.cardID);
      } else if (change.remove) {
        return '-' + change.remove.index + '$' + getId(change.remove);
      } else if (change.replace) {
        return `/${change.replace[0].index + '$' + getId(change.replace[0])}>${getId(change.replace[1])}`;
      }
    })
    .join(';');

  return (
    <>
      <ul className="changelist">
        {changes.map((change) => {
          if (change.add) {
            return <Add key={change.id} card={change.add} changeId={change.id} close={close} />;
          } else if (change.remove) {
            return <Remove key={change.id} card={change.remove} changeId={change.id} close={close} />;
          } else if (change.replace) {
            return <Replace key={change.id} cards={change.replace} changeId={change.id} close={close} />;
          }
        })}
      </ul>
      <Input type="hidden" name="body" value={changelistData} />
    </>
  );
};

export default Changelist;
