import React, { useContext, useState } from 'react';
import { Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DraftPropType from 'proptypes/DraftPropType';
import socketIOClient from 'socket.io-client';

import CubeDraft from 'components/CubeDraft';
import CubeDraftError from 'components/CubeDraftError';
import CubeDraftStaging from 'components/CubeDraftStaging';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import useMount from 'hooks/UseMount';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { callApi } from 'utils/CSRF';

const socket = socketIOClient('/', { rejectUnauthorized: false });

const CubeDraftPage = ({ cube, initialDraft, loginCallback }) => {
  const user = useContext(UserContext);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');

  const start = async () => {
    await callApi('/multiplayer/startdraft', { draft: initialDraft.id });
  };

  useMount(() => {
    const run = async () => {
      if (!user) {
        setState('error');
        setMessage('Please log in to join this draft.');
      } else {
        socket.on('draft', async (data) => {
          setState(data.state);
        });

        const res = await callApi('/multiplayer/isdraftinitialized', { draft: initialDraft.id });
        const json = await res.json();
        if (json.initialized) {
          if (!json.seats[user.id]) {
            setState('error');
            setMessage('The draft has already started, and you are not in this draft.');
            return;
          }

          setState('drafting');
        } else {
          setState('staging');
        }

        socket.emit('joinLobby', { draftId: initialDraft.id });
      }
    };
    run();
  });

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          {state === 'loading' && (
            <div className="centered py-3">
              <Spinner className="position-absolute" />
            </div>
          )}
          {state === 'staging' && <CubeDraftStaging draft={initialDraft} start={start} socket={socket} />}
          {state === 'drafting' && <CubeDraft draft={initialDraft} socket={socket} />}
          {state === 'error' && <CubeDraftError message={message} />}
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

CubeDraftPage.propTypes = {
  cube: CubePropType.isRequired,
  initialDraft: DraftPropType.isRequired,
  loginCallback: PropTypes.string,
};

CubeDraftPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeDraftPage);
