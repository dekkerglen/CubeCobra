import React, { useContext } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import Select from 'components/base/Select';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckCard from 'components/DeckCard';
import DraftExportMenu from 'components/draft/DraftExportMenu';
import DynamicFlash from 'components/DynamicFlash';
import SampleHandModal from 'components/modals/SampleHandModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const SampleHandModalLink = withModal(Link, SampleHandModal);

interface CubeDeckPageProps {
  cube: Cube;
  draft: Draft;
}

const CubeDeckPage: React.FC<CubeDeckPageProps> = ({ cube, draft }) => {
  const user = useContext(UserContext);
  const [seatIndex, setSeatIndex] = useQueryParam('seat', '0');
  const [view, setView] = useQueryParam('view', 'draft');

  const controlsContent = (
    <>
      {user && draft.owner && user.id === (draft.owner as User).id && draft.seats.length > 1 && (
        <NavMenu label="Edit">
          <Flexbox direction="col" gap="2" className="p-3">
            {draft.seats.map((seat, index) => (
              <Link key={index} href={`/draft/deckbuilder/${draft.id}?seat=${index}`} className="dropdown-item">
                Seat {index + 1}: {seat.name}
              </Link>
            ))}
          </Flexbox>
        </NavMenu>
      )}
      {user && draft.owner && user.id === (draft.owner as User).id && draft.seats.length === 1 && (
        <Link href={`/draft/deckbuilder/${draft.id}?seat=0`}>Edit</Link>
      )}
      <SampleHandModalLink
        modalprops={{
          deck: draft.seats[parseInt(seatIndex || '0')].mainboard?.flat(3).map((cardIndex) => draft.cards[cardIndex]),
        }}
      >
        Sample Hand
      </SampleHandModalLink>
      <Link href={`/cube/deck/rebuild/${draft.id}/${seatIndex}`}>Clone and Rebuild</Link>
      <CustomImageToggler />
      <DraftExportMenu draft={draft} seatIndex={seatIndex} />
    </>
  );

  const controls = (
    <Flexbox direction="col" gap="2" className="px-2">
      <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
        <Flexbox direction="row" justify="start" gap="2" alignItems="center" wrap="wrap">
          <Select
            value={seatIndex}
            setValue={setSeatIndex}
            options={draft.seats.map((seat, index) => ({
              value: index.toString(),
              label: `Seat ${index + 1}: ${seat.name}`,
            }))}
            dense
          />
          <Select
            value={view}
            setValue={setView}
            options={[
              { value: 'draft', label: 'Deck View' },
              { value: 'visual', label: 'Visual Spoiler' },
              { value: 'picks', label: 'Pick by Pick Breakdown' },
            ]}
            dense
          />
        </Flexbox>
      </Flexbox>
      <Flexbox direction="col" gap="2">
        {controlsContent}
      </Flexbox>
    </Flexbox>
  );

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest" controls={controls}>
          <DynamicFlash />
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
