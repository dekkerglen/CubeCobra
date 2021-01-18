import React, { useCallback, useRef, useState } from 'react';
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
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Spinner,
} from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
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
import UserPropType from 'proptypes/UserPropType';
import Draft, { init } from 'utils/Draft';
import { csrfFetch } from 'utils/CSRF';
import RenderToRoot from 'utils/RenderToRoot';

const CubeDeckPage = ({ user, cube, deck, draft, loginCallback }) => {
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

  const [loading, setLoading] = useState(false);

  const submitDeckForm = useRef();
  const [draftId, setDraftId] = useState('');

  const haveBotsRedraft = useCallback(async () => {
    if (!loading && draft) {
      setLoading(true);
      const response = await csrfFetch(`/cube/api/redraft/${draft._id}`, {
        method: 'POST',
      });
      const json = await response.json();
      init(json.draft);
      setDraftId(Draft.id());
      await Draft.allBotsDraft();
      submitDeckForm.current.submit();
    }
  }, [draft, loading]);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider>
          <CSRFForm
            key="submitdeck"
            className="d-none"
            innerRef={submitDeckForm}
            method="POST"
            action={`/cube/submitdeck/${cube._id}`}
          >
            <Input type="hidden" name="body" value={draftId} />
            <Input type="hidden" name="skipDeckbuilder" value="true" />
          </CSRFForm>
          <Navbar expand="md" light className="usercontrols mb-3">
            <div className="view-style-select pr-2">
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
            <div className="view-style-select pr-2">
              <Label className="sr-only" for="viewSelect">
                Cube View Style
              </Label>
              <Input type="select" id="viewSelect" value={view} onChange={handleChangeView}>
                <option value="deck">Deck View</option>
                <option value="picks">Pick by Pick Breakdown</option>
                <option value="draftbot">Draftbot Analysis</option>
              </Input>
            </div>
            <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
            <Collapse isOpen={isOpen} navbar>
              <Nav navbar>
                <NavItem>
                  <SampleHandModal deck={deck.seats[seatIndex].main} />
                </NavItem>
                {user && deck.owner === user.id && (
                  <NavItem>
                    <NavLink href={`/cube/deckbuilder/${deck._id}`}>Edit</NavLink>
                  </NavItem>
                )}
                {loading && <Spinner className="position-absolute" />}
                {draft ? (
                  <UncontrolledDropdown nav inNavbar>
                    <DropdownToggle nav caret>
                      Rebuild/Redraft
                    </DropdownToggle>
                    <DropdownMenu right>
                      <DropdownItem href={`/cube/redraft/${deck._id}`}>Redraft</DropdownItem>
                      <DropdownItem onClick={haveBotsRedraft}>Have Bots Redraft</DropdownItem>
                      <DropdownItem href={`/cube/rebuild/${deck._id}/${seatIndex}`}>Clone and Rebuild</DropdownItem>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                ) : (
                  <NavItem>
                    <NavLink href={`/cube/rebuild/${deck._id}/${seatIndex}`}>Clone and Rebuild</NavLink>
                  </NavItem>
                )}
                <CustomImageToggler />
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>
                    Export
                  </DropdownToggle>
                  <DropdownMenu right>
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
                userid={user ? user.id : null}
                deck={deck}
                seatIndex={`${seatIndex}`}
                draft={draft}
                view={view}
              />
            </Col>
          </Row>
        </DisplayContextProvider>
      </CubeLayout>
    </MainLayout>
  );
};

CubeDeckPage.propTypes = {
  cube: CubePropType.isRequired,
  deck: DeckPropType.isRequired,
  draft: PropTypes.shape({ _id: PropTypes.string.isRequired }).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeDeckPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeDeckPage);
