import React, { Fragment, useCallback, useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

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

const BulkUploadPageRaw = ({ cubeID, missing, blogpost, cube, canEdit }) => {
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
        const card = await getCard(cubeID, newValue || addValue);
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
    [addChange, addValue, addInput, cubeID],
  );

  return (
    <CubeLayout cube={cube} canEdit={canEdit} activeLink="list">
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
              {missing.split('\n').map((card, index) => (
                <Fragment key={/* eslint-disable-line react/no-array-index-key */ index}>
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
                <Button color="success" type="submit" className="mt-3" block outline>
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
  cubeID: PropTypes.string.isRequired,
  missing: PropTypes.string.isRequired,
  blogpost: PropTypes.shape({
    title: PropTypes.string.isRequired,
    html: PropTypes.string.isRequired,
  }).isRequired,
};

const BulkUploadPage = ({ user, cubeID, added, loginCallback, ...props }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <ChangelistContextProvider
      cubeID={cubeID}
      noSave
      initialChanges={added.map((details, index) => ({ add: { details }, id: index }))}
      setOpenCollapse={() => {}}
    >
      <BulkUploadPageRaw cubeID={cubeID} {...props} />
    </ChangelistContextProvider>
  </MainLayout>
);

BulkUploadPage.propTypes = {
  cubeID: PropTypes.string.isRequired,
  added: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }),
  ).isRequired,
  ...BulkUploadPageRaw.propTypes,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

BulkUploadPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(BulkUploadPage);
