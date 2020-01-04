import React, { useCallback, useContext, useRef, useState } from 'react';

import { Button, Col, Collapse, Form, Input, Label, Row, UncontrolledAlert } from 'reactstrap';

import AutocompleteInput from './AutocompleteInput';
import BlogpostEditor from './BlogpostEditor';
import Changelist from './Changelist';
import ChangelistContext from './ChangelistContext';
import ContentEditable from './ContentEditable';
import CSRFForm from './CSRFForm';

async function getCard(name) {
  if (name && name.length > 0) {
    const normalized = name.replace('?', '-q-');
    while (normalized.includes('//')) {
      normalized = normalized.replace('//', '-slash-');
    }
    const response = await fetch(`/cube/api/getcard/${normalized}`);
    if (!response.ok) {
      throw new Error(`Couldn\'t get card: ${response.status}.`);
    }

    const json = await response.json();
    if (json.success !== 'true' || !json.card) {
      return null;
    }
    return json.card;
  }
}

const EditCollapse = ({ cubeID, ...props }) => {
  const [postContent, setPostContent] = useState('');
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');

  const { changes, addChange, setChanges } = useContext(ChangelistContext);

  const addInput = useRef();
  const removeInput = useRef();
  const changelistForm = useRef();

  const handleChange = useCallback((event) => {
    return {
      postContent: setPostContent,
      add: setAddValue,
      remove: setRemoveValue,
    }[event.target.name](event.target.value);
  });

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      try {
        const card = await getCard(newValue || addValue);
        if (!card) {
          return;
        }
        addChange({ add: card });
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
        const cardOut = await getCard(newValue || removeValue);
        if (!cardOut) {
          return;
        }
        if (replace) {
          const cardIn = await getCard(addValue);
          if (!cardIn) {
            return;
          }
          addChange({ replace: [cardOut, cardIn] });
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
    [addChange, addInput, addValue, removeInput, removeValue],
  );

  const handleDiscardAll = useCallback(
    (event) => {
      setChanges([]);
    },
    [setChanges],
  );

  const handleSaveChanges = useCallback((event) => {
    changelistForm.current && changelistForm.current.submit();
  });

  return (
    <Collapse className="px-3" {...props}>
      <Row className="collapse warnings">
        <Col>
          <UncontrolledAlert color="danger">Invalid input: card not recognized.</UncontrolledAlert>
        </Col>
      </Row>
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
            <Button color="success" type="submit">
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
            <Button color="success" type="submit">
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
