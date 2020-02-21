import React, { useCallback, useState } from 'react';
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
  Label,
  Input,
  ListGroup,
  ListGroupItem,
} from 'reactstrap';

import CustomImageToggler from 'components/CustomImageToggler';
import { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import { getCardColorClass } from 'components/TagContext';
import withAutocard from 'components/WithAutocard';
import CubeLayout from 'layouts/CubeLayout';
import DeckCard from 'components/DeckCard';

const AutocardItem = withAutocard(ListGroupItem);

const CubeDeckPage = ({ cube, deck, canEdit, userid }) => {
  const [seatIndex, setSeatIndex] = useState(0);
  const handleChangeSeat = (event) => {
    const target = event.target;
    const value = target.value;
    setSeatIndex(value);
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
                <option key={index} value={index}>
                  {seat.username ? seat.username : seat.name}
                </option>
              ))}
            </Input>
          </div>
          <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
          <Collapse isOpen={isOpen} navbar>
            <Nav navbar>
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
            <DeckCard seat={deck.seats[seatIndex]} comments={deck.comments} deckid={deck._id} userid={userid} />
          </Col>
        </Row>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

CubeDeckPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  deck: PropTypes.shape({}).isRequired,
  canEdit: PropTypes.bool,
};

CubeDeckPage.defaultProps = {
  canEdit: false,
  cards: null,
  sideboard: [],
};

export default CubeDeckPage;
