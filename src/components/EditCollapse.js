import React, { useCallback, useContext, useRef, useState } from 'react';

import { Button, Col, Collapse, Form, Row, UncontrolledAlert } from 'reactstrap';

import { encodeName } from '../util/Card';

import AutocompleteInput from './AutocompleteInput';
import BlogpostEditor from './BlogpostEditor';
import Changelist from './Changelist';
import ChangelistContext from './ChangelistContext';
import CubeContext from './CubeContext';
import CSRFForm from './CSRFForm';

const EditCollapse = ({ cubeID, ...props }) => {
  const [alerts, setAlerts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');

  const { changes, addChange, setChanges } = useContext(ChangelistContext);
  const { cube } = useContext(CubeContext);

  const getCard = useCallback(async (name) => {
    if (name && name.length > 0) {
      const normalized = encodeName(name);
      const response = await fetch(`/cube/api/getcard/${normalized}`);
      if (!response.ok) {
        setAlerts(alerts => [...alerts, { color: 'danger', message: `Couldn't get card: ${response.status}.` }]);
        return null;
      }

      const json = await response.json();
      if (json.success !== 'true' || !json.card) {
        setAlerts(alerts => [...alerts, { color: 'danger', message: `Couldn't find card [${name}].` }]);
        return null;
      }
      return json.card;
    }
  }, []);

  const addInput = useRef();
  const removeInput = useRef();
  const changelistForm = useRef();

  const handleChange = useCallback((event) => {
    return {
      postContent: setPostContent,
      add: setAddValue,
      remove: setRemoveValue,
    }[event.target.name](event.target.value);
  }, []);

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      try {
        const card = await getCard(newValue || addValue);
        if (!card) {
          return;
        }
        addChange({ add: { details: card } });
        setAddValue('');
        setRemoveValue('');
        addInput.current && addInput.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addValue, addInput],
  );

  const handleRemoveReplace = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        const cardOut = cube.find(card => card.details.name.toLowerCase() === (newValue || removeValue).toLowerCase());
        if (!cardOut) {
          setAlerts(alerts => [...alerts, { color: 'danger', message: `Couldn't find a card with name [${newValue || removeValue}].` }]);
          return;
        }
        if (replace) {
          const cardIn = await getCard(addValue);
          if (!cardIn) {
            return;
          }
          addChange({ replace: [cardOut, { details: cardIn }] });
        } else {
          addChange({ remove: cardOut });
        }
        setAddValue('');
        setRemoveValue('');
        /* If replace, put focus back in addInput; otherwise leave it here. */
        const focus = replace ? addInput : removeInput;
        focus.current && focus.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addInput, addValue, removeInput, removeValue, cube],
  );

  const handleDiscardAll = useCallback(
    (event) => {
      setChanges([]);
    },
    [],
  );

  const handleSaveChanges = useCallback((event) => {
    changelistForm.current && changelistForm.current.submit();
  });

  return (
    <Collapse className="px-3" {...props}>
      {alerts.map(({ color, message }) => (
        <UncontrolledAlert color={color} className="mt-2">{message}</UncontrolledAlert>
      ))}
      <Row>
        <Col xs="12" sm="auto">
          <Form inline className="mb-2" onSubmit={handleAdd}>
            <AutocompleteInput
              treeUrl="/cube/api/cardnames"
              treePath="cardnames"
              type="text"
              className="mr-2"
              innerRef={addInput}
              name="add"
              value={addValue}
              onChange={handleChange}
              onSubmit={handleAdd}
              placeholder="Card to Add"
              autoComplete="off"
              data-lpignore
            />
            <Button color="success" type="submit" disabled={addValue.length === 0}>
              Just Add
            </Button>
          </Form>
        </Col>
        <Col xs="12" sm="auto">
          <Form inline className="mb-2" onSubmit={handleRemoveReplace}>
            <AutocompleteInput
              treeUrl={`/cube/api/cubecardnames/${cubeID}`}
              treePath="cardnames"
              type="text"
              className="mr-2"
              innerRef={removeInput}
              name="remove"
              value={removeValue}
              onChange={handleChange}
              onSubmit={handleRemoveReplace}
              placeholder="Card to Remove"
              autoComplete="off"
              data-lpignore
            />
            <Button color="success" type="submit" disabled={removeValue.length === 0}>
              Remove/Replace
            </Button>
          </Form>
        </Col>
      </Row>
      <Collapse isOpen={changes.length > 0} className="pt-1">
        <CSRFForm innerRef={changelistForm} method="POST" action={`/cube/edit/${cubeID}`}>
          <Row>
            <Col>
              <h6>Changelist</h6>
              <Changelist />
            </Col>
            <Col>
              <BlogpostEditor value={postContent} onChange={handleChange} />
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
