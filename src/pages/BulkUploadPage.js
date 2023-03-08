import React, { useCallback, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';

import useMount from 'hooks/UseMount';

import { Col, Label, Row, Card, CardBody, CardHeader, UncontrolledAlert } from 'reactstrap';

import useLocalStorage from 'hooks/useLocalStorage';
import CubeContext from 'contexts/CubeContext';
import AutocompleteInput from 'components/AutocompleteInput';
import Changelist from 'components/Changelist';
import { getCard } from 'components/EditCollapse';
import LoadingButton from 'components/LoadingButton';
import CubeLayout from 'layouts/CubeLayout';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const DEFAULT_BLOG_TITLE = 'Cube Updated – Automatic Post';

const BulkUploadPageRaw = ({ missing, added }) => {
  const [addValue, setAddValue] = useState('');

  const { alerts, setAlerts, cube, loading, addCard, bulkAddCard, commitChanges } = useContext(CubeContext);

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, DEFAULT_BLOG_TITLE);
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, '');

  const addInput = useRef();

  useMount(() => {
    bulkAddCard(
      added.map((cardid) => ({ cardID: cardid, addedTmsp: new Date().valueOf(), status: cube.defaultStatus })),
      'mainboard',
    );
  });

  const submit = useCallback(async () => {
    await commitChanges(postTitle, postContent);
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');

    // go to cube page
    window.location.href = `/cube/list/${cube.id}`;
  }, [commitChanges, cube.id, postContent, postTitle, setPostContent, setPostTitle]);

  const handleAdd = useCallback(
    async (event, match) => {
      event.preventDefault();
      try {
        const card = await getCard(cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard({ cardID: card._id, addedTmsp: new Date().valueOf(), status: cube.defaultStatus }, 'mainboard');
        setAddValue('');

        addInput.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard],
  );
  return (
    <Card className="mt-3">
      <CardHeader>
        <h5>Confirm Upload</h5>
      </CardHeader>
      <CardBody>
        <p>
          There were a few problems with your bulk upload. Below is a list of unrecognized cards, please go through and
          manually add them. No changes have been saved.
        </p>
        <Row>
          <Col>
            {missing.map((card, index) => (
              <p key={/* eslint-disable-line react/no-array-index-key */ index}>{card}</p>
            ))}
          </Col>
          <Col>
            <Row>
              <Col xs="8">
                <AutocompleteInput
                  treeUrl="/cube/api/cardnames"
                  treePath="cardnames"
                  type="text"
                  innerRef={addInput}
                  value={addValue}
                  setValue={setAddValue}
                  placeholder="Card to Add"
                  noMargin
                />
              </Col>
              <Col xs="4">
                <LoadingButton
                  block
                  color="accent"
                  disabled={addValue.length === 0}
                  loading={loading}
                  onClick={(e) => handleAdd(e, addValue)}
                >
                  Add
                </LoadingButton>
              </Col>
            </Row>
            {alerts.map(({ color, message }) => (
              <UncontrolledAlert color={color} className="mt-2">
                {message}
              </UncontrolledAlert>
            ))}
            <Label>Changelist:</Label>
            <div className="changelist-container mb-2">
              <Changelist />
            </div>
            <LoadingButton loading={loading} color="accent" className="mt-3" block outline onClick={submit}>
              Save Changes
            </LoadingButton>
          </Col>
        </Row>
      </CardBody>
    </Card>
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

const BulkUploadPage = ({ cube, cards, added, loginCallback, blogpost, missing }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <CubeLayout cube={cube} cards={cards} activeLink="list" useChangedCards>
      <BulkUploadPageRaw added={added} blogpost={blogpost} missing={missing} />
    </CubeLayout>
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
