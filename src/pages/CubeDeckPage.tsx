import { Col, Flexbox, Row } from 'components/base/Layout';
import Cube from 'datatypes/Cube';
import Deck from 'datatypes/Deck';
import Draft from 'datatypes/Draft';
import React, { useContext } from 'react';

import CustomImageToggler from 'components/CustomImageToggler';
import DeckCard from 'components/DeckCard';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import Controls from 'components/base/Controls';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
import Select from 'components/base/Select';
import SampleHandModal from 'components/modals/SampleHandModal';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import User from 'datatypes/User';

const SampleHandModalLink = withModal(Link, SampleHandModal);

interface CubeDeckPageProps {
  cube: Cube;
  deck: Deck;
  draft?: Draft | null;
  loginCallback: string;
}

const CubeDeckPage: React.FC<CubeDeckPageProps> = ({ cube, deck, loginCallback }) => {
  const user = useContext(UserContext);
  const [seatIndex, setSeatIndex] = useQueryParam('seat', '0');
  const [view, setView] = useQueryParam('view', 'deck');

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Controls>
            <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
              <Select
                value={seatIndex}
                setValue={setSeatIndex}
                options={deck.seats.map((seat, index) => ({
                  value: index.toString(),
                  label: `Seat ${index + 1}: ${seat.name}`,
                }))}
                dense
              />
              <Select
                value={view}
                setValue={setView}
                options={[
                  { value: 'deck', label: 'Deck View' },
                  { value: 'visual', label: 'Visual Spoiler' },
                  { value: 'picks', label: 'Pick by Pick Breakdown' },
                ]}
                dense
              />
              {user && deck.owner && user.id === (deck.owner as User).id && (
                <Link href={`/cube/deck/edit/${deck.id}/${seatIndex}`} className="nav-link">
                  Edit
                </Link>
              )}
              <SampleHandModalLink
                modalprops={{
                  deck: deck.seats[parseInt(seatIndex || '0')].mainboard
                    ?.flat(3)
                    .map((cardIndex) => deck.cards[cardIndex]),
                }}
              >
                Sample Hand
              </SampleHandModalLink>
              <Link href={`/cube/deck/rebuild/${deck.id}/${seatIndex}`} className="nav-link">
                Clone and Rebuild
              </Link>
              <CustomImageToggler />
              <NavMenu label="Export">
                <Flexbox direction="col" gap="2" className="p-3">
                  <Link href={`/cube/deck/download/txt/${deck.id}/${seatIndex}`} className="dropdown-item">
                    Card Names (.txt)
                  </Link>
                  <Link href={`/cube/deck/download/forge/${deck.id}/${seatIndex}`} className="dropdown-item">
                    Forge (.dck)
                  </Link>
                  <Link href={`/cube/deck/download/xmage/${deck.id}/${seatIndex}`} className="dropdown-item">
                    XMage (.dck)
                  </Link>
                  <Link href={`/cube/deck/download/mtgo/${deck.id}/${seatIndex}`} className="dropdown-item">
                    MTGO (.txt)
                  </Link>
                  <Link href={`/cube/deck/download/arena/${deck.id}/${seatIndex}`} className="dropdown-item">
                    Arena (.txt)
                  </Link>
                  <Link href={`/cube/deck/download/cockatrice/${deck.id}/${seatIndex}`} className="dropdown-item">
                    Cockatrice (.txt)
                  </Link>
                  <Link href={`/cube/deck/download/topdecked/${deck.id}/${seatIndex}`} className="dropdown-item">
                    TopDecked (.csv)
                  </Link>
                </Flexbox>
              </NavMenu>
            </Flexbox>
          </Controls>
          <DynamicFlash />
          <Row className="mt-3 mb-3">
            <Col>
              <DeckCard seat={deck.seats[parseInt(seatIndex)]} deck={deck} seatIndex={`${seatIndex}`} view={view} />
            </Col>
          </Row>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckPage);
