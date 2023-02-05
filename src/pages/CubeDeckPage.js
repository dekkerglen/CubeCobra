import React, { useCallback, useState, useContext } from 'react';
import PropTypes from 'prop-types';

import {
  Col,
  Collapse,
  Nav,
  Navbar,
  NavbarToggler,
  NavItem,
  NavLink,
  Row,
  Input,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  // Spinner,
} from 'reactstrap';

// import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckCard from 'components/DeckCard';
import DynamicFlash from 'components/DynamicFlash';
import SampleHandModal from 'components/SampleHandModal';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';

import UserContext from 'contexts/UserContext';
import RenderToRoot from 'utils/RenderToRoot';
import DraftPropType from 'proptypes/DraftPropType';

const CubeDeckPage = ({ cube, deck, draft, loginCallback }) => {
  const user = useContext(UserContext);

  const [seatIndex, setSeatIndex] = useQueryParam('seat', 0);
  const [view, setView] = useQueryParam('view', 'deck');

  const handleChangeSeat = (event) => {
    setSeatIndex(event.target.value);
  };

  const handleChangeView = (event) => {
    setView(event.target.value);
  };

  const [isOpen, setIsOpen] = useState(false);
  const toggleNavbar = useCallback(
    (event) => {
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen],
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Navbar expand="md" light className="usercontrols mb-3">
            <div className="view-style-select pe-2">
              <Input type="select" id="viewSelect" value={seatIndex} onChange={handleChangeSeat}>
                {deck.seats.map((seat, index) => (
                  <option key={seat.title} value={index}>
                    {`Seat ${index + 1}: ${seat.title}`}
                  </option>
                ))}
              </Input>
            </div>
            <div className="view-style-select pe-2">
              <Input type="select" id="viewSelect" value={view} onChange={handleChangeView}>
                <option value="deck">Deck View</option>
                <option value="picks">Pick by Pick Breakdown</option>
              </Input>
            </div>
            <NavbarToggler onClick={toggleNavbar} className="ms-auto" />
            <Collapse isOpen={isOpen} navbar>
              <Nav navbar>
                <NavItem>
                  <SampleHandModal
                    deck={deck.seats[seatIndex].mainboard.map((row) =>
                      row.map((col) => col.map((cardIndex) => deck.cards[cardIndex])),
                    )}
                  />
                </NavItem>
                {user && deck.seats[seatIndex].userid === user.id && (
                  <NavItem>
                    <NavLink href={`/cube/deck/deckbuilder/${deck._id}`}>Edit</NavLink>
                  </NavItem>
                )}
                {draft ? (
                  <UncontrolledDropdown nav inNavbar>
                    <DropdownToggle nav caret>
                      Rebuild/Redraft Seat
                    </DropdownToggle>
                    <DropdownMenu end>
                      <DropdownItem href={`/cube/deck/redraft/${deck._id}/${seatIndex}`}>Redraft</DropdownItem>
                      <DropdownItem href={`/cube/deck/rebuild/${deck._id}/${seatIndex}`}>
                        Clone and Rebuild
                      </DropdownItem>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                ) : (
                  <NavItem>
                    <NavLink href={`/cube/deck/rebuild/${deck._id}/${seatIndex}`}>Clone and Rebuild</NavLink>
                  </NavItem>
                )}
                <CustomImageToggler />
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    Export
                  </DropdownToggle>
                  <DropdownMenu end>
                    <DropdownItem href={`/cube/deck/download/txt/${deck._id}/${seatIndex}`}>
                      Card Names (.txt)
                    </DropdownItem>
                    <DropdownItem href={`/cube/deck/download/forge/${deck._id}/${seatIndex}`}>
                      Forge (.dck)
                    </DropdownItem>
                    <DropdownItem href={`/cube/deck/download/xmage/${deck._id}/${seatIndex}`}>
                      XMage (.dck)
                    </DropdownItem>
                    <DropdownItem href={`/cube/deck/download/mtgo/${deck._id}/${seatIndex}`}>MTGO (.txt)</DropdownItem>
                    <DropdownItem href={`/cube/deck/download/arena/${deck._id}/${seatIndex}`}>
                      Arena (.txt)
                    </DropdownItem>
                    <DropdownItem href={`/cube/deck/download/cockatrice/${deck._id}/${seatIndex}`}>
                      Cockatrice (.txt)
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              </Nav>
            </Collapse>
          </Navbar>
          <DynamicFlash />
          <Row className="mt-3 mb-3">
            <Col>
              <DeckCard
                seat={deck.seats[seatIndex]}
                deckid={deck._id}
                deck={deck}
                seatIndex={`${seatIndex}`}
                draft={draft}
                view={view}
              />
            </Col>
          </Row>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

CubeDeckPage.propTypes = {
  cube: CubePropType.isRequired,
  deck: DeckPropType.isRequired,
  draft: DraftPropType,
  loginCallback: PropTypes.string,
};

CubeDeckPage.defaultProps = {
  loginCallback: '/',
  draft: null,
};

export default RenderToRoot(CubeDeckPage);
