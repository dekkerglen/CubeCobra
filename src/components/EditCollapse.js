import React, { useCallback, useContext, useRef, useState } from 'react';

import { Button, Col, Collapse, Form, InputGroup, InputGroupAddon, Row, UncontrolledAlert } from 'reactstrap';

import { encodeName } from '../utils/Card';

import AutocompleteInput from './AutocompleteInput';
import BlogpostEditor from './BlogpostEditor';
import Changelist from './Changelist';
import ChangelistContext from './ChangelistContext';
import CubeContext from './CubeContext';
import CSRFForm from './CSRFForm';
import DisplayContext from './DisplayContext';
import ResizeModal from './ResizeModal';

export const getCard = async (cubeID, name, setAlerts) => {
  if (name && name.length > 0) {
    const normalized = encodeName(name);
    const response = await fetch(`/cube/api/getcardforcube/${cubeID}/${normalized}`);
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
};

const EditCollapse = ({ ...props }) => {
  const [alerts, setAlerts] = useState([]);
  const [postContent, setPostContent] = useState('');

  const {
    changes,
    addValue,
    setAddValue,
    removeValue,
    setRemoveValue,
    addInputRef,
    removeInputRef,
    addChange,
    setChanges,
  } = useContext(ChangelistContext);
  const { cube, cubeID } = useContext(CubeContext);
  const { toggleShowMaybeboard } = useContext(DisplayContext);

  const changelistForm = useRef();

  const handleChange = useCallback((event) => {
    return {
      blog: setPostContent,
      add: setAddValue,
      remove: setRemoveValue,
    }[event.target.name](event.target.value);
  }, []);

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      try {
        const card = await getCard(cubeID, newValue || addValue, setAlerts);
        if (!card) {
          return;
        }
        addChange({ add: { details: card } });
        setAddValue('');
        setRemoveValue('');
        addInputRef.current && addInputRef.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addValue, addInputRef, cubeID],
  );

  const handleRemoveReplace = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        const cardOut = cube.cards.find(
          (card) =>
            card.details.name.toLowerCase() === (newValue || removeValue).toLowerCase() &&
            !changes.some(
              (change) =>
                (change.remove && change.remove.index === card.index) ||
                (Array.isArray(change.replace) && change.replace[0].index === card.index),
            ),
        );
        if (!cardOut) {
          setAlerts((alerts) => [
            ...alerts,
            { color: 'danger', message: `Couldn't find a card with name [${newValue || removeValue}].` },
          ]);
          return;
        }
        if (replace) {
          const cardIn = await getCard(cubeID, addValue, setAlerts);
          if (!cardIn) {
            return;
          }
          addChange({ replace: [cardOut, { details: cardIn }] });
        } else {
          addChange({ remove: cardOut });
        }
        setAddValue('');
        setRemoveValue('');
        /* If replace, put focus back in addInputRef; otherwise leave it here. */
        const focus = replace ? addInputRef : removeInputRef;
        focus.current && focus.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addInputRef, addValue, removeInputRef, removeValue, cube, cubeID, changes],
  );

  const handleDiscardAll = useCallback((event) => {
    setChanges([]);
  }, []);

  const handleSaveChanges = useCallback((event) => {
    changelistForm.current && changelistForm.current.submit();
  });

  return (
    <Collapse className="px-3" {...props}>
      {alerts.map(({ color, message }, index) => (
        <UncontrolledAlert key={index} color={color} className="mt-2">
          {message}
        </UncontrolledAlert>
      ))}
      <Row noGutters>
        <Row noGutters className="mr-auto">
          <Form inline className="mb-2 mr-2" onSubmit={handleAdd}>
            <InputGroup className="flex-nowrap">
              <AutocompleteInput
                treeUrl="/cube/api/cardnames"
                treePath="cardnames"
                type="text"
                innerRef={addInputRef}
                name="add"
                value={addValue}
                onChange={handleChange}
                onSubmit={handleAdd}
                placeholder="Card to Add"
                autoComplete="off"
                data-lpignore
                className="square-right"
              />
              <InputGroupAddon addonType="append">
                <Button color="success" type="submit" disabled={addValue.length === 0}>
                  Add
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Form>
          <Form inline className="mb-2 mr-2" onSubmit={handleRemoveReplace}>
            <InputGroup className="flex-nowrap">
              <AutocompleteInput
                treeUrl={`/cube/api/cubecardnames/${cubeID}`}
                treePath="cardnames"
                type="text"
                innerRef={removeInputRef}
                name="remove"
                value={removeValue}
                onChange={handleChange}
                onSubmit={handleRemoveReplace}
                placeholder="Card to Remove"
                autoComplete="off"
                data-lpignore
                className="square-right"
              />
              <InputGroupAddon addonType="append">
                <Button color="success" type="submit" disabled={removeValue.length === 0}>
                  Remove/Replace
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Form>
        </Row>
        <ResizeModal cubeID={cubeID} />
        <Button color="success" className="mb-2" onClick={toggleShowMaybeboard}>
          Maybeboard
        </Button>
      </Row>
      <Collapse isOpen={changes.length > 0} className="pt-1">
        <CSRFForm innerRef={changelistForm} method="POST" action={`/cube/edit/${cubeID}`}>
          <Row>
            <Col>
              <h6>Changelist</h6>
              <div className="changelist-container mb-2">
                <Changelist />
              </div>
            </Col>
            <Col>
              <BlogpostEditor maxLength={10000} name="blog" value={postContent} onChange={handleChange} />
            </Col>
          </Row>
          <Row className="mb-2">
            <Col>
              <Button color="success" className="mr-2" onClick={handleSaveChanges}>
                Save Changes
              </Button>
              <Button color="danger" onClick={handleDiscardAll}>
                Discard All
              </Button>
            </Col>
          </Row>
        </CSRFForm>
      </Collapse>
    </Collapse>
  );
};

export default EditCollapse;
