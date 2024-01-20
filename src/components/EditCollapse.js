/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Col,
  Collapse,
  InputGroup,
  Row,
  UncontrolledAlert,
  FormGroup,
  Label,
  Input,
  InputGroupText,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

import AutocompleteInput from 'components/AutocompleteInput';
import Changelist from 'components/Changelist';
import DisplayContext from 'contexts/DisplayContext';
import CubeContext from 'contexts/CubeContext';
import TextEntry from 'components/TextEntry';
import useLocalStorage from 'hooks/useLocalStorage';
import LoadingButton from 'components/LoadingButton';

export const getCard = async (defaultprinting, name, setAlerts) => {
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
        setAlerts((alerts) => [...alerts, { color: 'danger', message }]);
      } else {
        console.error(message);
      }
      return null;
    }

    const json = await response.json();
    if (json.success !== 'true' || !json.card) {
      const message = `Couldn't find card [${name}].`;
      if (setAlerts) {
        setAlerts((alerts) => [...alerts, { color: 'danger', message }]);
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

const EditCollapse = ({ isOpen }) => {
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');
  const { showMaybeboard, toggleShowMaybeboard } = useContext(DisplayContext);
  const addRef = useRef();
  const removeRef = useRef();

  const {
    cube,
    changes,
    addCard,
    removeCard,
    swapCard,
    changedCards,
    discardAllChanges,
    commitChanges,
    alerts,
    setAlerts,
    loading,
    useBlog,
    setUseBlog,
  } = useContext(CubeContext);

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, '');
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, DEFAULT_BLOG_TITLE);
  const [activeBoard, setActiveBoard] = useLocalStorage(`${cube.id}-useMaybeboard`, 'mainboard');
  const [specifyEdition, setSpecifyEdition] = useLocalStorage(`${cube.id}-specifyEdition`, false);

  const handleAdd = useCallback(
    async (event, match) => {
      event.preventDefault();
      try {
        const card = await getCard(cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard(
          { cardID: card.scryfall_id, addedTmsp: new Date().valueOf(), status: cube.defaultStatus },
          showMaybeboard ? activeBoard : 'mainboard',
        );
        setAddValue('');

        addRef.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard, showMaybeboard, activeBoard],
  );

  const handleRemoveReplace = useCallback(
    async (event, match) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        let removeIndex = -1;
        const board = changedCards[showMaybeboard ? activeBoard : 'mainboard'];
        for (let i = 0; i < board.length; i++) {
          if (!board[i].markedForDelete && board[i].details.name.toLowerCase() === match.toLowerCase()) {
            removeIndex = board[i].index;
          }
        }

        if (removeIndex === -1) {
          setAlerts((items) => [
            ...items,
            {
              color: 'danger',
              message: `Couldn't find a card with name "${match}" in "${showMaybeboard ? activeBoard : 'mainboard'}".`,
            },
          ]);
          return;
        }

        if (replace) {
          const card = await getCard(cube.defaultPrinting, addValue, setAlerts);
          if (!card) {
            return;
          }
          swapCard(
            removeIndex,
            { cardID: card.scryfall_id, addedTmsp: new Date().valueOf(), status: cube.defaultStatus },
            showMaybeboard ? activeBoard : 'mainboard',
          );
        } else {
          removeCard(removeIndex, showMaybeboard ? activeBoard : 'mainboard');
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
    [
      addValue,
      changedCards,
      showMaybeboard,
      activeBoard,
      cube.defaultPrinting,
      cube.defaultStatus,
      swapCard,
      removeCard,
    ],
  );

  const submit = useCallback(async () => {
    commitChanges(postTitle, postContent);
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');
  }, [commitChanges, postContent, postTitle, setPostContent, setPostTitle]);

  return (
    <Collapse className="px-3" isOpen={isOpen}>
      {alerts.map(({ color, message }) => (
        <UncontrolledAlert color={color} className="mt-2">
          {message}
        </UncontrolledAlert>
      ))}
      <Row className="mb-2">
        {showMaybeboard && (
          <Col xs={12} md={3}>
            <InputGroup className="mb-1">
              <Input disabled value="Board" />
              <Input value={activeBoard} onChange={(e) => setActiveBoard(e.target.value)} name="select" type="select">
                <option>mainboard</option>
                <option>maybeboard</option>
              </Input>
            </InputGroup>
          </Col>
        )}
        <Col xs={12} md={3}>
          <InputGroup className="mb-1">
            <AutocompleteInput
              treeUrl={specifyEdition ? '/cube/api/fullnames' : '/cube/api/cardnames'}
              treePath="cardnames"
              type="text"
              innerRef={addRef}
              name="add"
              value={addValue}
              setValue={setAddValue}
              onSubmit={handleAdd}
              placeholder="Card to Add"
              autoComplete="off"
              data-lpignore
              className="square-right"
            />
            <Button color="accent" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)}>
              Add
            </Button>
          </InputGroup>
        </Col>
        <Col xs={12} md={4}>
          <InputGroup className="flex-nowrap mb-1">
            <AutocompleteInput
              cubeId={cube.id}
              treeUrl={`/cube/api/cubecardnames/${cube.id}/${showMaybeboard ? activeBoard : 'mainboard'}`}
              treePath="cardnames"
              type="text"
              innerRef={removeRef}
              name="remove"
              value={removeValue}
              setValue={setRemoveValue}
              onSubmit={handleRemoveReplace}
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
          </InputGroup>
        </Col>
      </Row>
      <Row className="mb-2">
        <Col xs={12} md={2}>
          <InputGroup className="mb-1">
            <InputGroupText>
              <Input
                addon
                type="checkbox"
                aria-label="Checkbox for following text input"
                checked={specifyEdition}
                onChange={() => setSpecifyEdition(!specifyEdition)}
              />
            </InputGroupText>
            <Input disabled value="Specify Versions" />
          </InputGroup>
        </Col>
        <Col xs={12} md={2}>
          <InputGroup className="mb-1">
            <InputGroupText>
              <Input
                addon
                type="checkbox"
                aria-label="Checkbox for following text input"
                checked={showMaybeboard}
                onChange={toggleShowMaybeboard}
              />
            </InputGroupText>
            <Input disabled value="Use Maybeboard" />
          </InputGroup>
        </Col>
        <Col xs={12} md={2}>
          <InputGroup className="mb-1">
            <InputGroupText>
              <Input
                addon
                type="checkbox"
                aria-label="Checkbox for following text input"
                checked={useBlog}
                onChange={() => setUseBlog(!useBlog)}
              />
            </InputGroupText>
            <Input disabled value="Create Blog Post" />
          </InputGroup>
        </Col>
      </Row>
      <Collapse isOpen={Object.entries(changes).length > 0} className="pt-1">
        <Row>
          <Col xs="12" md="6">
            <Changelist />
          </Col>
          {useBlog && (
            <Col xs="12" md="6">
              <h6>Blog Post</h6>
              <FormGroup>
                <Label className="visually-hidden">Blog title</Label>
                <Input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
              </FormGroup>
              <FormGroup>
                <Label className="visually-hidden">Blog body</Label>
                <TextEntry
                  name="blog"
                  value={postContent}
                  onChange={(event) => setPostContent(event.target.value)}
                  maxLength={10000}
                />
              </FormGroup>
            </Col>
          )}
        </Row>
        <Row className="mb-2">
          <Col xs="6" md="3">
            <LoadingButton color="accent" block className="me-2" onClick={submit} loading={loading}>
              Save Changes
            </LoadingButton>
          </Col>
          <Col xs="6" md="3">
            <Button
              color="unsafe"
              block
              onClick={() => {
                discardAllChanges();
                setPostTitle(DEFAULT_BLOG_TITLE);
                setPostContent('');
              }}
            >
              Discard All
            </Button>
          </Col>
        </Row>
      </Collapse>
    </Collapse>
  );
};

EditCollapse.propTypes = {
  isOpen: PropTypes.bool,
};

EditCollapse.defaultProps = {
  isOpen: false,
};

export default EditCollapse;
