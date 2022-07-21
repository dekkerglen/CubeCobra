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

const EditCollapse = ({ cubeView, ...props }) => {
  const [alerts, setAlerts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [addValue, setAddValue] = useState('');
  const [activeBoard, setActiveBoard] = useState('Mainboard');
  const [removeValue, setRemoveValue] = useState('');
  const [specifyEdition, setSpecifyEdition] = useState(false);
  const { showMaybeboard, toggleShowMaybeboard } = useContext(DisplayContext);
  const addRef = useRef();
  const removeRef = useRef();

  const { cube, changes, addCard, removeCard, swapCard, changedCards, discardAllChanges, commitChanges } =
    useContext(CubeContext);

  const handleChange = useCallback(
    (event) => {
      return {
        add: setAddValue,
        remove: setRemoveValue,
      }[event.target.name](event.target.value);
    },
    [setAddValue, setRemoveValue],
  );

  const handleAdd = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        const card = await getCard(cube.DefaultPrinting, addValue, setAlerts);
        if (!card) {
          return;
        }
        addCard({ cardID: card._id, addedTmsp: new Date().valueOf(), status: cube.DefaultStatus }, activeBoard);
        setAddValue('');

        addRef.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [cube.DefaultPrinting, cube.DefaultStatus, addValue, addCard, activeBoard],
  );

  const handleRemoveReplace = useCallback(
    async (event) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        let removeIndex = -1;
        const board = changedCards[activeBoard];
        for (let i = 0; i < board.length; i++) {
          if (!board[i].markedForDelete && board[i].details.name.toLowerCase() === removeValue.toLowerCase()) {
            removeIndex = i;
          }
        }

        if (removeIndex === -1) {
          setAlerts((items) => [
            ...items,
            { color: 'danger', message: `Couldn't find a card with name "${removeValue}" in "${activeBoard}".` },
          ]);
          return;
        }

        if (replace) {
          const card = await getCard(cube.DefaultPrinting, addValue, setAlerts);
          if (!card) {
            return;
          }
          swapCard(
            removeIndex,
            { cardID: card._id, addedTmsp: new Date().valueOf(), status: cube.DefaultStatus },
            activeBoard,
          );
        } else {
          removeCard(removeIndex, activeBoard);
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
    [addValue, changedCards, activeBoard, removeValue, cube.DefaultPrinting, cube.DefaultStatus, swapCard, removeCard],
  );

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      commitChanges();
    },
    [commitChanges],
  );

  return (
    <Collapse className="px-3" {...props}>
      {alerts.map(({ color, message }) => (
        <UncontrolledAlert color={color} className="mt-2">
          {message}
        </UncontrolledAlert>
      ))}
      <Row className="mb-2">
        {showMaybeboard && (
          <Col xs={12} md={3}>
            <InputGroup>
              <Input disabled value="Board" />
              <Input value={activeBoard} onChange={(e) => setActiveBoard(e.target.value)} name="select" type="select">
                <option>Mainboard</option>
                <option>Maybeboard</option>
              </Input>
            </InputGroup>
          </Col>
        )}
        <Col xs={12} md={3}>
          <InputGroup>
            <AutocompleteInput
              treeUrl={specifyEdition ? '/cube/api/fullnames' : '/cube/api/cardnames'}
              treePath="cardnames"
              type="text"
              innerRef={addRef}
              name="add"
              value={addValue}
              onChange={handleChange}
              onSubmit={handleAdd}
              placeholder="Card to Add"
              autoComplete="off"
              data-lpignore
              className="square-right"
            />
            <Button color="accent" disabled={addValue.length === 0} onClick={handleAdd}>
              Add
            </Button>
          </InputGroup>
        </Col>
        <Col xs={12} md={4}>
          <InputGroup className="flex-nowrap">
            <AutocompleteInput
              cubeId={cube._id}
              treeUrl={`/cube/api/cubecardnames/${cube.Id}`}
              treePath="cardnames"
              type="text"
              innerRef={removeRef}
              name="remove"
              value={removeValue}
              onChange={handleChange}
              onSubmit={handleRemoveReplace}
              placeholder="Card to Remove"
              autoComplete="off"
              data-lpignore
              className="square-right"
            />
            <Button color="accent" disabled={removeValue.length === 0} onClick={handleRemoveReplace}>
              Remove/Replace
            </Button>
          </InputGroup>
        </Col>
      </Row>
      <Row className="mb-2">
        <Col xs={12} md={2}>
          <InputGroup>
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
          <InputGroup>
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
      </Row>
      <Collapse isOpen={Object.entries(changes).length > 0} className="pt-1">
        <Row>
          <Col>
            <Changelist />
          </Col>
          <Col>
            <h6>Blog Post</h6>
            <FormGroup>
              <Label className="visually-hidden">Blog Title</Label>
              <Input type="text" name="title" defaultValue="Cube Updated – Automatic Post" />
            </FormGroup>
            <FormGroup>
              <Label className="visually-hidden">Blog Body</Label>
              <TextEntry
                name="blog"
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
                maxLength={10000}
              />
            </FormGroup>
          </Col>
        </Row>
        <Row className="mb-2">
          <Col>
            <Button color="accent" className="me-2" onClick={submit}>
              Save Changes
            </Button>
            <Button color="unsafe" onClick={discardAllChanges}>
              Discard All
            </Button>
          </Col>
        </Row>
      </Collapse>
    </Collapse>
  );
};

EditCollapse.propTypes = {
  cubeView: PropTypes.string.isRequired,
};

export default EditCollapse;
