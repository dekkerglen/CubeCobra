import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Collapse, Nav, Navbar, NavbarToggler, NavItem, NavLink, Row, Label, Input } from 'reactstrap';

import CustomImageToggler from 'components/CustomImageToggler';
import { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import CubeLayout from 'layouts/CubeLayout';
import DeckCard from 'components/DeckCard';
import SampleHandModal from 'components/SampleHandModal';

const CubeDeckPage = ({ cube, deck, canEdit, userid, draft }) => {
  const [seatIndex, setSeatIndex] = useState(0);
  const [view, setView] = useState('deck');

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
    <CubeLayout cube={cube} cubeID={deck.cube} activeLink="playtest">
      <DisplayContextProvider>
        <Navbar expand="md" light className="usercontrols mb-3">
          <div className="view-style-select">
            <Label className="sr-only" for="viewSelect">
              Cube View Style
            </Label>
            <Input type="select" id="viewSelect" value={seatIndex} onChange={handleChangeSeat}>
              {deck.seats.map((seat, index) => (
                <option key={seat._id} value={index}>
                  {seat.username ? seat.username : seat.name}
                </option>
              ))}
            </Input>
          </div>
          <div className="view-style-select px-2">
            <Label className="sr-only" for="viewSelect">
              Cube View Style
            </Label>
            <Input type="select" id="viewSelect" value={view} onChange={handleChangeView}>
              <option value="deck">Deck View</option>
              <option value="picks">Pick by Pick Breakdown</option>
            </Input>
          </div>
          <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
          <Collapse isOpen={isOpen} navbar>
            <Nav navbar>
              <NavItem>
                <SampleHandModal deck={deck.seats[seatIndex].deck} />
              </NavItem>
              {canEdit && (
                <NavItem>
                  <NavLink href={`/cube/deckbuilder/${deck._id}`}>Edit</NavLink>
                </NavItem>
              )}
              <NavItem>
                <NavLink href={`/cube/redraft/${deck._id}`}>Redraft</NavLink>
              </NavItem>
              <NavItem className="mr-auto">
                <NavLink href={`/cube/rebuild/${deck._id}/${seatIndex}`}>Clone and Rebuild</NavLink>
              </NavItem>
              <CustomImageToggler />
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        <Row className="mt-3">
          <Col>
            <DeckCard
              seat={deck.seats[seatIndex]}
              comments={deck.comments}
              deckid={deck._id}
              userid={userid}
              deck={deck}
              seatIndex={seatIndex}
              draft={draft}
              view={view}
            />
          </Col>
        </Row>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

CubeDeckPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
      }),
    ).isRequired,
    cube: PropTypes.string.isRequired,
    comments: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  canEdit: PropTypes.bool,
  userid: PropTypes.string,
  draft: PropTypes.shape({}).isRequired,
};

CubeDeckPage.defaultProps = {
  canEdit: false,
  userid: null,
};

export default CubeDeckPage;
