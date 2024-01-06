import React, { useContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';
import CubePropType from 'proptypes/CubePropType';

import { Col, Nav, Navbar, NavLink, NavItem, Row } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import CustomDraftFormatModal from 'components/CustomDraftFormatModal';
import DynamicFlash from 'components/DynamicFlash';
import withModal from 'components/WithModal';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import CubeLayout from 'layouts/CubeLayout';
import { csrfFetch } from 'utils/CSRF';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import SamplePackCard from 'components/SamplePackCard';
import UploadDecklistModal from 'components/UploadDecklistModal';
import CustomDraftCard from 'components/CustomDraftCard';
import StandardDraftCard from 'components/StandardDraftCard';
import GridDraftCard from 'components/GridDraftCard';
import SealedCard from 'components/SealedCard';
import PlaytestDecksCard from 'components/PlaytestDecksCard';

const UploadDecklistModalLink = withModal(NavLink, UploadDecklistModal);

const DEFAULT_FORMAT = {
  title: 'Unnamed Format',
  multiples: false,
  markdown: '',
  packs: [{ slots: ['rarity:Mythic', 'tag:new', 'identity>1'], steps: null }],
};

function CubePlaytestPage({ cube, decks, loginCallback }) {
  const user = useContext(UserContext);

  const { alerts, addAlert } = useAlerts();
  const [formats, setFormats] = useState(cube.formats ?? []);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormatIndex, setEditFormatIndex] = useState(-1);
  const [editFormat, setEditFormat] = useState({});
  const [defaultDraftFormat, setDefaultDraftFormat] = useState(cube.defaultFormat ?? -1);

  const toggleEditModal = useCallback(() => setEditModalOpen((open) => !open), []);

  const handleCreateFormat = useCallback(() => {
    setEditFormat(DEFAULT_FORMAT);
    setEditFormatIndex(-1);
    setEditModalOpen(true);
  }, []);

  const handleEditFormat = useCallback(
    (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      setEditFormat(formats[formatIndex]);
      setEditFormatIndex(formatIndex);
      setEditModalOpen(true);
    },
    [formats],
  );

  const handleDeleteFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      try {
        const response = await csrfFetch(`/cube/format/remove/${cube.id}/${formatIndex}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw Error();

        const json = await response.json();
        if (json.success !== 'true') throw Error();

        addAlert('success', 'Format successfully deleted.');
        setFormats(formats.filter((_, index) => index !== formatIndex));
      } catch (err) {
        console.error(err);
        addAlert('danger', 'Failed to delete format.');
      }
    },
    [addAlert, cube.id, formats],
  );

  const handleSetDefaultFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      try {
        const response = await csrfFetch(`/cube/${cube.id}/defaultdraftformat/${formatIndex}`, {
          method: 'POST',
        });

        if (!response.ok) throw Error();

        const json = await response.json();
        if (json.success !== 'true') throw Error();
        addAlert('success', 'Format successfully set as default.');
        setDefaultDraftFormat(formatIndex);
      } catch (err) {
        console.error(err);
        addAlert('danger', 'Failed to set format as default.');
      }
    },
    [addAlert, cube.id],
  );

  // Sort formats alphabetically.
  const formatsSorted = useMemo(
    () =>
      formats
        .map((format, index) => ({ ...format, index }))
        .sort((a, b) => {
          if (a.index === defaultDraftFormat) {
            return -1;
          }
          if (b.index === defaultDraftFormat) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        }),
    [formats, defaultDraftFormat],
  );

  function StandardDraftFormatCard() {
    return (
      <StandardDraftCard
        className="mb-3"
        onSetDefaultFormat={handleSetDefaultFormat}
        defaultDraftFormat={defaultDraftFormat}
      />
    );
  }

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        {user && cube.owner.id === user.id ? (
          <Navbar light expand className="usercontrols mb-3">
            <Nav navbar>
              <NavItem>
                <NavLink onClick={handleCreateFormat} className="clickable">
                  Create Custom Draft
                </NavLink>
              </NavItem>
              <NavItem>
                <UploadDecklistModalLink className="clickable">Upload Decklist</UploadDecklistModalLink>
              </NavItem>
            </Nav>
          </Navbar>
        ) : (
          <Row className="mb-3" />
        )}
        <DynamicFlash />
        <Alerts alerts={alerts} />
        <Row className="justify-content-center">
          <Col xs="12" md="6" xl="6">
            {defaultDraftFormat === -1 && <StandardDraftFormatCard />}
            {formatsSorted.map((format) => (
              <CustomDraftCard
                key={format.id}
                format={format}
                onDeleteFormat={handleDeleteFormat}
                onSetDefaultFormat={handleSetDefaultFormat}
                onEditFormat={handleEditFormat}
                defaultDraftFormat={defaultDraftFormat}
                className="mb-3"
              />
            ))}
            {defaultDraftFormat !== -1 && <StandardDraftFormatCard />}
            <SealedCard className="mb-3" />
            <GridDraftCard className="mb-3" />
          </Col>
          <Col xs="12" md="6" xl="6">
            <SamplePackCard className="mb-3" />
            {decks.length !== 0 && <PlaytestDecksCard decks={decks} className="mb-3" />}
          </Col>
        </Row>
        <CustomDraftFormatModal
          isOpen={editModalOpen}
          toggle={toggleEditModal}
          formatIndex={editFormatIndex}
          format={editFormat}
          setFormat={setEditFormat}
        />
      </CubeLayout>
    </MainLayout>
  );
}

CubePlaytestPage.propTypes = {
  cube: CubePropType.isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  loginCallback: PropTypes.string,
};

CubePlaytestPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubePlaytestPage);
