import React, { Fragment, useCallback, useContext, useRef, useState } from 'react';

import { Button, Col, Form, Input, Label, Row } from 'reactstrap';

import AutocompleteInput from './AutocompleteInput';
import CSRFForm from './CSRFForm';
import Changelist from './Changelist';
import ChangelistContext, { ChangelistContextProvider } from './ChangelistContext';
import { getCard } from './EditCollapse';
import LoadingButton from './LoadingButton';

const BulkUploadPageRaw = ({ cubeID, missing, blogpost }) => {
  const [addValue, setAddValue] = useState('');
  const [loading, setLoading] = useState(false);

  const { addChange } = useContext(ChangelistContext);

  const addInput = useRef();
  const formRef = useRef();

  const handleChange = useCallback((event) => setAddValue(event.target.value), []);

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      try {
        setLoading(true);
        const card = await getCard(newValue || addValue);
        if (!card) {
          return;
        }
        addChange({ add: { details: card } });
        setAddValue('');
        setLoading(false);
        addInput.current && addInput.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addValue, addInput],
  );

  return (
    <>
      <h5 className="mt-3">Confirm Upload</h5>
      <p>
        There were a few problems with your bulk upload. Below is a list of unrecognized cards, please go through and
        manually add them. No changes have been saved.
      </p>
      <Row>
        <Col>
          {missing.split('\n').map((card, index) => (
            <Fragment key={index}>
              {card}
              <br />
            </Fragment>
          ))}
        </Col>
        <Col>
          <Form inline className="mb-2" onSubmit={handleAdd}>
            <AutocompleteInput
              treeUrl="/cube/api/cardnames"
              treePath="cardnames"
              type="text"
              className="mr-2"
              innerRef={addInput}
              value={addValue}
              onChange={handleChange}
              onSubmit={handleAdd}
              placeholder="Card to Add"
            />
            <LoadingButton color="success" type="submit" disabled={addValue.length === 0} loading={loading}>
              Add
            </LoadingButton>
          </Form>
          <CSRFForm method="POST" action={`/cube/edit/${cubeID}`} innerRef={formRef}>
            <Label>Changelist:</Label>
            <div className="changelist-container mb-2">
              <Changelist />
            </div>
            <Input type="hidden" name="title" value={blogpost.title} />
            <Input type="hidden" name="blog" value={blogpost.html} />
            <Button color="success" type="submit" className="mt-3">
              Save Changes
            </Button>
          </CSRFForm>
        </Col>
      </Row>
    </>
  );
};

const BulkUploadPage = ({ cubeID, added, ...props }) => (
  <ChangelistContextProvider
    cubeID={cubeID}
    noSave
    initialChanges={added.map((details, index) => ({ add: { details }, id: index }))}
    setOpenCollapse={() => {}}
  >
    <BulkUploadPageRaw cubeID={cubeID} {...props} />
  </ChangelistContextProvider>
);

export default BulkUploadPage;
