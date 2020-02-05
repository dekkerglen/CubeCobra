import React from 'react';
import PropTypes from 'prop-types';

import { Collapse, Nav, Navbar } from 'reactstrap';

import BoosterDraftView from 'components/BoosterDraftView';
import CustomImageToggler from 'components/CustomImageToggler';
import DynamicFlash from 'components/DynamicFlash';
import { DisplayContextProvider } from 'components/DisplayContext';
import ErrorBoundary from 'components/ErrorBoundary';
import GridDraftView from 'components/GridDraftView';
import CubeLayout from 'layouts/CubeLayout';

const CubeDraftPage = ({ cube, cubeID, initialDraft }) => (
  <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
    <DisplayContextProvider>
      <Navbar expand="xs" light className="usercontrols">
        <Collapse navbar>
          <Nav navbar>
            <CustomImageToggler />
          </Nav>
        </Collapse>
      </Navbar>
      <DynamicFlash />
      <ErrorBoundary>
        {initialDraft.type === 'booster' && <BoosterDraftView initialDraft={initialDraft} />}
        {initialDraft.type === 'grid' && <GridDraftView initialDraft={initialDraft} />}
      </ErrorBoundary>
    </DisplayContextProvider>
  </CubeLayout>
);

CubeDraftPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDraft: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
};

export default CubeDraftPage;
