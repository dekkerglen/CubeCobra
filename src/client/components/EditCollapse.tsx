import React, { Dispatch, SetStateAction, useCallback, useContext, useRef, useState } from 'react';

import AutocompleteInput from './base/AutocompleteInput';
import Changelist from './Changelist';
import LoadingButton from './LoadingButton';
import TextEntry from './TextEntry';
import CubeContext from '../contexts/CubeContext';
import DisplayContext, { DisplayContextValue } from '../contexts/DisplayContext';
import { BoardType } from '../../datatypes/Card';
import { CardDetails } from '../../datatypes/Card';
import useLocalStorage from '../hooks/useLocalStorage';
import Alert, { UncontrolledAlertProps } from './base/Alert';
import Collapse from './base/Collapse';
import { Col, Flexbox, Row } from './base/Layout';
import Select from './base/Select';
import Button from './base/Button';
import Checkbox from './base/Checkbox';
import Input from './base/Input';
import { CSRFContext } from '../contexts/CSRFContext';

interface GetCardResponse {
  success: 'true' | 'false';
  card: CardDetails;
}

export const getCard = async (
  csrfFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  defaultprinting: string,
  name: string,
  setAlerts?: Dispatch<SetStateAction<UncontrolledAlertProps[]>>,
): Promise<CardDetails | null> => {
  if (name && name.length > 0) {
    const response = await csrfFetch(`/cube/api/getcardforcube`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        defaultprinting,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const message = `Couldn't get card: ${response.status}.`;
      if (setAlerts) {
        setAlerts((alerts: UncontrolledAlertProps[]) => [...alerts, { color: 'danger', message }]);
      } else {
        console.error(message);
      }
      return null;
    }

    const json: GetCardResponse = await response.json();
    if (json.success !== 'true' || !json.card) {
      const message = `Couldn't find card [${name}].`;
      if (setAlerts) {
        setAlerts((alerts: UncontrolledAlertProps[]) => [...alerts, { color: 'danger', message }]);
      } else {
        console.error(message);
      }
      return null;
    }
    return json.card;
  }
  return null;
};

const DEFAULT_BLOG_TITLE = 'Cube Updated – Automatic Post';

interface EditCollapseProps {
  isOpen: boolean;
}

const EditCollapse: React.FC<EditCollapseProps> = ({ isOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');
  const { showMaybeboard, toggleShowMaybeboard } = useContext(DisplayContext) as DisplayContextValue;
  const addRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLInputElement>(null);

  const {
    cube,
    changes,
    addCard,
    removeCard,
    swapCard,
    changedCards,
    clearChanges,
    commitChanges,
    alerts,
    setAlerts,
    loading,
    useBlog,
    setUseBlog,
  } = useContext(CubeContext)!;

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, '');
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, DEFAULT_BLOG_TITLE);
  const [activeBoard, setActiveBoard] = useLocalStorage<BoardType>(`${cube.id}-useMaybeboard`, 'mainboard');
  const [specifyEdition, setSpecifyEdition] = useLocalStorage(`${cube.id}-specifyEdition`, false);

  const boardToEdit = showMaybeboard ? activeBoard : 'mainboard';

  const handleAdd = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      try {
        const card = await getCard(csrfFetch, cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard(
          { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
          boardToEdit,
        );
        setAddValue('');

        if (addRef.current) {
          addRef.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard, boardToEdit],
  );

  const handleRemoveReplace = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        let removeIndex = -1;
        const board = changedCards[boardToEdit];
        for (let i = 0; i < board.length; i++) {
          const card = board[i];
          if (
            !card.markedForDelete &&
            card.index !== undefined &&
            card.details?.name.toLowerCase() === match.toLowerCase()
          ) {
            removeIndex = card.index;
          }
        }

        if (removeIndex === -1) {
          setAlerts((items) => [
            ...items,
            {
              color: 'danger',
              message: `Couldn't find a card with name "${match}" in "${boardToEdit}".`,
            },
          ]);
          return;
        }

        if (replace) {
          const card = await getCard(csrfFetch, cube.defaultPrinting, addValue, setAlerts);
          if (!card) {
            return;
          }
          swapCard(
            removeIndex,
            { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
            boardToEdit,
          );
        } else {
          removeCard(removeIndex, boardToEdit);
        }

        setAddValue('');
        setRemoveValue('');

        const focus = replace ? addRef : removeRef;
        if (focus.current) {
          focus.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [addValue, changedCards, boardToEdit, setAlerts, cube.defaultPrinting, cube.defaultStatus, swapCard, removeCard],
  );

  const submit = useCallback(async () => {
    commitChanges(postTitle, postContent);
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');
  }, [commitChanges, postContent, postTitle, setPostContent, setPostTitle]);

  return (
    <Collapse isOpen={isOpen}>
      <Flexbox direction="col" gap="2" className="mt-2">
        {alerts.map(({ color, message }, index) => (
          <Alert key={index} color={color}>
            {message}
          </Alert>
        ))}
        <Row className="items-end">
          {showMaybeboard && (
            <Col xs={12} md={3}>
              <Select
                label="Board"
                value={activeBoard}
                setValue={(value) => setActiveBoard(value as BoardType)}
                options={[
                  { value: 'mainboard', label: 'Mainboard' },
                  { value: 'maybeboard', label: 'Maybeboard' },
                ]}
              />
            </Col>
          )}
          <Col xs={12} md={3}>
            <Flexbox direction="row" justify="start" gap="1">
              <AutocompleteInput
                treeUrl={specifyEdition ? '/cube/api/fullnames' : '/cube/api/cardnames'}
                treePath="cardnames"
                type="text"
                innerRef={addRef}
                name="add"
                value={addValue}
                setValue={setAddValue}
                //Can't be addValue or else the selected text from the autocomplete input is ignored
                onSubmit={(e, addCardValue) => handleAdd(e, addCardValue!)}
                placeholder="Card to Add"
                autoComplete="off"
                data-lpignore
                className="square-right"
              />
              <Button color="primary" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)}>
                Add
              </Button>
            </Flexbox>
          </Col>
          <Col xs={12} md={4}>
            <Flexbox direction="row" justify="start" gap="1">
              <AutocompleteInput
                cubeId={cube.id}
                treeUrl={`/cube/api/cubecardnames/${cube.id}/${boardToEdit}`}
                treePath="cardnames"
                type="text"
                innerRef={removeRef}
                name="remove"
                value={removeValue}
                setValue={setRemoveValue}
                onSubmit={(e, removeCardValue) => handleRemoveReplace(e, removeCardValue!)}
                placeholder="Card to Remove"
                autoComplete="off"
                data-lpignore
                className="square-right"
              />
              <Button
                color="accent"
                disabled={removeValue.length === 0}
                onClick={(e) => handleRemoveReplace(e, removeValue)}
              >
                Remove/Replace
              </Button>
            </Flexbox>
          </Col>
        </Row>
        <Flexbox direction="row" justify="start" gap="4" wrap="wrap">
          <Checkbox
            label="Specify Versions"
            checked={specifyEdition}
            setChecked={(value) => setSpecifyEdition(value)}
          />
          <Checkbox label="Use Maybeboard" checked={showMaybeboard} setChecked={toggleShowMaybeboard} />
          <Checkbox label="Create Blog Post" checked={useBlog} setChecked={(value) => setUseBlog(value)} />
        </Flexbox>
        <Collapse
          isOpen={
            Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
              (c) => c.length > 0,
            ) ||
            Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
              (c) => c.length > 0,
            )
          }
          className="pt-1"
        >
          <Row>
            <Col xs={12} md={6}>
              <Changelist />
            </Col>
            {useBlog && (
              <Col xs={12} md={6}>
                <Flexbox direction="col" gap="2">
                  <Input
                    label="Blog Post"
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                  />
                  <TextEntry name="blog" value={postContent} setValue={setPostContent} maxLength={10000} />
                </Flexbox>
              </Col>
            )}
          </Row>
          <Row className="mb-2">
            <Col xs={6} md={3}>
              <LoadingButton color="primary" block onClick={submit} loading={loading}>
                Save Changes
              </LoadingButton>
            </Col>
            <Col xs={6} md={3}>
              <Button
                color="danger"
                block
                onClick={() => {
                  clearChanges();
                  setPostTitle(DEFAULT_BLOG_TITLE);
                  setPostContent('');
                }}
              >
                Discard All
              </Button>
            </Col>
          </Row>
        </Collapse>
      </Flexbox>
    </Collapse>
  );
};

export default EditCollapse;
