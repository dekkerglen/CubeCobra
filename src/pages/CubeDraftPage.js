import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import CubeDraft from 'components/CubeDraft';
import CubeDraftStaging from 'components/CubeDraftStaging';
import DraftPropType from 'proptypes/DraftPropType';
import RenderToRoot from 'utils/RenderToRoot';
import useMount from 'hooks/UseMount';
import socketIOClient from 'socket.io-client';
import { callApi } from 'utils/CSRF';

import { Spinner } from 'reactstrap';

const socket = socketIOClient('localhost:8080', { rejectUnauthorized: false });

const CubeDraftPage = ({ cube, initialDraft, seatNumber, loginCallback }) => {
  const [state, setState] = useState('loading');

  const start = async () => {
    await callApi('/multiplayer/startdraft', { draft: initialDraft._id });

    setState('drafting');
  };

  useMount(() => {
    const run = async () => {
      socket.emit('joinDraft', { draftId: initialDraft._id, seat: seatNumber });

      const res = await callApi('/multiplayer/isdraftinitialized', { draft: initialDraft._id });
      const json = await res.json();
      if (json.initialized) {
        setState('drafting');
      } else {
        setState('staging');
      }
    };
    run();
  });

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider>
          {state === 'loading' && (
            <div className="centered py-3">
              <Spinner className="position-absolute" />
            </div>
          )}
          {state === 'staging' && (
            <CubeDraftStaging draft={initialDraft} seat={seatNumber} start={start} socket={socket} />
          )}
          {state === 'drafting' && <CubeDraft draft={initialDraft} seat={seatNumber} socket={socket} />}
        </DisplayContextProvider>
      </CubeLayout>
    </MainLayout>
  );
};

CubeDraftPage.propTypes = {
  cube: CubePropType.isRequired,
  initialDraft: DraftPropType.isRequired,
  seatNumber: PropTypes.number,
  loginCallback: PropTypes.string,
};

CubeDraftPage.defaultProps = {
  seatNumber: 0,
  loginCallback: '/',
};

export default RenderToRoot(CubeDraftPage);
