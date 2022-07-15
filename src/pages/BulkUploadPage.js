import React, { Fragment, useCallback, useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, Col, Form, Input, Label, Row, Card, CardBody, CardHeader } from 'reactstrap';

import AutocompleteInput from 'components/AutocompleteInput';
import CSRFForm from 'components/CSRFForm';
import Changelist from 'components/Changelist';
import ChangelistContext, { ChangelistContextProvider } from 'contexts/ChangelistContext';
import { getCard } from 'components/EditCollapse';
import LoadingButton from 'components/LoadingButton';
import CubeLayout from 'layouts/CubeLayout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BulkUploadPageRaw = ({ missing, blogpost, cube, cards }) => {
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
        const card = await getCard(cube.Id, newValue || addValue);
        if (!card) {
          return;
        }
        addChange({ add: { details: card } });
        setAddValue('');
        setLoading(false);
        if (addInput.current) {
          addInput.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [addChange, addValue, addInput, cube],
  );

  return (
    <CubeLayout cards={cards} cube={cube} activeLink="list">
      <Card className="mt-3">
        <CardHeader>
          <h5>Confirm Upload</h5>
        </CardHeader>
        <CardBody>
          <p>
            There were a few problems with your bulk upload. Below is a list of unrecognized cards, please go through
            and manually add them. No changes have been saved.
          </p>
          <Row>
            <Col>
              {missing.map((card, index) => (
                <Fragment key={/* eslint-disable-line react/no-array-index-key */ index}>
                  {card}
                  <br />
                </Fragment>
              ))}
            </Col>
            <Col>
              <Form className="mb-2 row row-cols-auto gx-2" onSubmit={handleAdd}>
                <Col>
                  <AutocompleteInput
                    treeUrl="/cube/api/cardnames"
                    treePath="cardnames"
                    type="text"
                    className="me-2"
                    innerRef={addInput}
                    value={addValue}
                    onChange={handleChange}
                    onSubmit={handleAdd}
                    placeholder="Card to Add"
                  />
                </Col>
                <Col>
                  <LoadingButton color="accent" type="submit" disabled={addValue.length === 0} loading={loading}>
                    Add
                  </LoadingButton>
                </Col>
              </Form>
              <CSRFForm method="POST" action={`/cube/edit/${cube.Id}`} innerRef={formRef}>
                <Label>Changelist:</Label>
                <div className="changelist-container mb-2">
                  <Changelist />
                </div>
                <Input type="hidden" name="title" value={blogpost.title} />
                <Input type="hidden" name="blog" value={blogpost.html} />
                <Button color="accent" type="submit" className="mt-3" block outline>
                  Save Changes
                </Button>
              </CSRFForm>
            </Col>
          </Row>
        </CardBody>
      </Card>
    </CubeLayout>
  );
};

BulkUploadPageRaw.propTypes = {
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  missing: PropTypes.arrayOf(PropTypes.string).isRequired,
  blogpost: PropTypes.shape({
    title: PropTypes.string.isRequired,
    html: PropTypes.string.isRequired,
  }).isRequired,
};

const BulkUploadPage = ({ cube, added, loginCallback, ...props }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <ChangelistContextProvider
      cubeID={cube.Id}
      noSave
      initialChanges={added.map((details, index) => ({ add: { details }, id: index }))}
      setOpenCollapse={() => {}}
    >
      <BulkUploadPageRaw cube={cube} {...props} />
    </ChangelistContextProvider>
  </MainLayout>
);

BulkUploadPage.propTypes = {
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  added: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }),
  ).isRequired,
  ...BulkUploadPageRaw.propTypes,
  loginCallback: PropTypes.string,
};

BulkUploadPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(BulkUploadPage);
