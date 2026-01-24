import React, { useContext } from 'react';

import { ChevronUpIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import Collapse from 'components/base/Collapse';
import Controls from 'components/base/Controls';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
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
import useToggle from 'hooks/UseToggle';
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
  const [expanded, toggleExpanded] = useToggle(false);

  const controls = (
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

  return (
    <MainLayout>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest" hasControls>
          <Controls>
            <Flexbox direction="row" justify="between" alignItems="center" className="py-2 px-4">
              <Flexbox direction="row" justify="start" gap="4" alignItems="center">
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
              <ResponsiveDiv baseVisible lg>
                <Button color="secondary" onClick={toggleExpanded}>
                  {expanded ? <ChevronUpIcon size={32} /> : <ThreeBarsIcon size={32} />}
                </Button>
              </ResponsiveDiv>
              <ResponsiveDiv lg>
                <Flexbox direction="row" justify="start" gap="4" alignItems="center">
                  {controls}
                </Flexbox>
              </ResponsiveDiv>
            </Flexbox>
            <ResponsiveDiv baseVisible lg>
              <Collapse isOpen={expanded}>
                <Flexbox direction="col" gap="2" className="py-2 px-4">
                  {controls}
                </Flexbox>
              </Collapse>
            </ResponsiveDiv>
          </Controls>
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
