import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import CubeDraft from 'components/CubeDraft';
import CubeDraftError from 'components/CubeDraftError';
import CubeDraftStaging from 'components/CubeDraftStaging';
import DraftPropType from 'proptypes/DraftPropType';
import RenderToRoot from 'utils/RenderToRoot';
import useMount from 'hooks/UseMount';
import socketIOClient from 'socket.io-client';
import { callApi } from 'utils/CSRF';
import UserContext from 'contexts/UserContext';

import { Spinner } from 'reactstrap';

const socket = socketIOClient('localhost:8080', { rejectUnauthorized: false });

const CubeDraftPage = ({ cube, initialDraft, loginCallback }) => {
  const user = useContext(UserContext);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');

  const start = async () => {
    await callApi('/multiplayer/startdraft', { draft: initialDraft._id });
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

        const res = await callApi('/multiplayer/isdraftinitialized', { draft: initialDraft._id });
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

        socket.emit('joinLobby', { draftId: initialDraft._id });
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
          {state === 'staging' && <CubeDraftStaging draft={initialDraft} start={start} socket={socket} />}
          {state === 'drafting' && <CubeDraft draft={initialDraft} socket={socket} />}
          {state === 'error' && <CubeDraftError message={message} />}
        </DisplayContextProvider>
      </CubeLayout>
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
