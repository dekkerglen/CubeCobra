import React, { useContext } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';

import { Col, Row } from 'components/base/Layout';
import CubeDeckNavbar from 'components/cube/CubeDeckNavbar';
import DeckCard from 'components/DeckCard';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeDeckPageProps {
  cube: Cube;
  draft: Draft;
}

const CubeDeckPage: React.FC<CubeDeckPageProps> = ({ cube, draft }) => {
  const user = useContext(UserContext);
  const [seatIndex, setSeatIndex] = useQueryParam('seat', '0');
  const [view, setView] = useQueryParam('view', 'draft');

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <DynamicFlash />
          <CubeDeckNavbar
            draft={draft}
            user={user}
            seatIndex={seatIndex}
            setSeatIndex={setSeatIndex}
            view={view}
            setView={setView}
          />
          <Row className="mt-3 mb-3">
            <Col>
              <DeckCard seat={draft.seats[parseInt(seatIndex)]} draft={draft} seatIndex={`${seatIndex}`} view={view} />
            </Col>
          </Row>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckPage);
