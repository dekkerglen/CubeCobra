import React, { useCallback, useContext } from 'react';

import { Badge, Input } from 'reactstrap';

import ChangelistContext from './ChangelistContext';
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
    <TextAutocard card={{ details: card }}>{card.name}</TextAutocard>
  </li>
);

const Remove = ({ card, changeId, close }) => (
  <li>
    <CloseButton changeId={changeId} close={close} /> <Badge color="danger">-</Badge>{' '}
    <TextAutocard card={{ details: card }}>{card.name}</TextAutocard>
  </li>
);

const Replace = ({ cards, changeId, close }) => (
  <li>
    <CloseButton changeId={changeId} close={close} /> <Badge color="primary">→</Badge>{' '}
    <TextAutocard card={{ details: cards[0] }}>{cards[0].name}</TextAutocard>
    {' > '}
    <TextAutocard card={{ details: cards[1] }}>{cards[1].name}</TextAutocard>
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

  const changelistData = changes
    .map((change) => {
      if (change.add) {
        return '+' + change.add._id;
      } else if (change.remove) {
        return '-' + change.remove._id;
      } else if (change.replace) {
        return `/${change.replace[0]._id}>${change.replace[1]._id}`;
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
            return <Remove key={change.id} card={change.add} changeId={change.id} close={close} />;
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
