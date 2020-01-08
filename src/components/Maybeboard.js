import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { Button, Form, ListGroupItem, Spinner } from 'reactstrap';

import { csrfFetch } from '../util/CSRF';

import AutocompleteInput from './AutocompleteInput';
import ChangelistContext from './ChangelistContext';
import CubeContext from './CubeContext';
import { getCard } from './EditCollapse';
import LoadingButton from './LoadingButton';
import MaybeboardContext, { MaybeboardContextProvider } from './MaybeboardContext';
import TableView from './TableView';
import { getCardColorClass } from './TagContext';
import withAutocard from './WithAutocard';

const AutocardItem = withAutocard(ListGroupItem);

const MaybeboardListItem = ({ card, className }) => {
  const { cubeID } = useContext(CubeContext);
  const { removeMaybeboardCard } = useContext(MaybeboardContext);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    (event) => {
      event.preventDefault();
    },
    [],
  );

  const handleRemove = useCallback(
    async (event) => {
      event.preventDefault();
      const index = parseInt(event.currentTarget.getAttribute('data-index'));
      if (isNaN(index)) {
        console.error('Bad index');
        return;
      }

      setLoading(true);
      const response = await csrfFetch(`/cube/api/maybe/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({
          remove: [index],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          removeMaybeboardCard(index);
          /* global */ autocard_hide_card();
        } else {
          setLoading(false);
          console.error(json.message);
        }
      }
    },
    [removeMaybeboardCard, cubeID]
  );

  return (
    <AutocardItem
      className={`d-flex card-list-item ${getCardColorClass(card)} ${className || ''}`}
      card={card}
    >
      <div className="name">{card.details.name}</div>
      {loading ?
        <Spinner size="sm" className="ml-auto" />
          :
        <Button size="sm" close className="ml-auto float-none" data-index={card.index} onClick={handleRemove} />
      }
    </AutocardItem>
  );
};

const MaybeboardView = ({ filter, ...props }) => {
  const { cubeID } = useContext(CubeContext);
  const { maybeboard, addMaybeboardCard } = useContext(MaybeboardContext);
  const addInput = useRef();
  const [loading, setLoading] = useState(false);

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      if (!addInput.current) return;
      try {
        setLoading(true);
        const card = await getCard(newValue || addInput.current.value);
        if (!card) {
          setLoading(false);
          return;
        }

        const response = await csrfFetch(`/cube/api/maybe/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({
            add: [{ details: card }],
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success === 'true') {
            addMaybeboardCard({ cardID: card._id, details: card });
          } else {
            console.error(json.message);
          }
        }
        setLoading(false);

        addInput.current.value = '';
        addInput.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addMaybeboardCard, addInput, cubeID],
  );

  const maybeboardIndex = useMemo(() => maybeboard.map((card, index) => ({ ...card, index })), [maybeboard]);

  const filteredMaybeboard = useMemo(() => {
    return (filter && filter.length > 0) ? maybeboardIndex.filter((card) => Filter.filterCard(card, filter)) : maybeboardIndex;
  }, [filter, maybeboardIndex]);

  return (
    <>
      <h4>Maybeboard</h4>
      <Form inline className="mt-2" onSubmit={handleAdd}>
        <AutocompleteInput
          treeUrl="/cube/api/cardnames"
          treePath="cardnames"
          type="text"
          className="mr-2"
          disabled={loading}
          innerRef={addInput}
          onSubmit={handleAdd}
          placeholder="Card to Add"
          autoComplete="off"
          data-lpignore
        />
        <LoadingButton color="success" type="submit" loading={loading}>
          Add
        </LoadingButton>
      </Form>
      {maybeboard.length === 0 ?
        <h5 className="mt-3">
          No cards in maybeboard
          {(filter && filter.length > 0) ? ' matching filter.' : '.'}
        </h5>
        :
        <TableView className="mt-3" cards={filteredMaybeboard} rowTag={MaybeboardListItem} {...props} />
      }
      <hr />
    </>
  );
};

const Maybeboard = ({ initialCards, ...props }) =>
  <MaybeboardContextProvider initialCards={initialCards}>
    <MaybeboardView {...props} />
  </MaybeboardContextProvider>;

export default Maybeboard;
