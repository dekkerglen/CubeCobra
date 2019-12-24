import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, Collapse, Form, Modal, ModalBody, ModalFooter, ModalHeader, Nav, Navbar, NavbarToggler, NavItem, NavLink, Input } from 'reactstrap';

import CSRFForm from './CSRFForm';

const COLORS = [['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G']];
const MAX_BASICS = 20;

const BasicsModal = ({ isOpen, toggle, handleAddBasics }) => {
  const refs = {};
  for (const [long, short] of COLORS) {
    refs[short] = useRef(0);
  }
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="sm">
      <ModalHeader toggle={toggle}>
        Add Basic Lands
      </ModalHeader>
      <ModalBody>
        {COLORS.map(([long, short]) =>
          <Form key={short} className="mb-1" inline>
            <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={long} title={long} className="mr-1" />
            <Input type="select" name={long} defaultValue={0} ref={refs[short]}>
              {Array.from(new Array(MAX_BASICS).keys()).map(n =>
                <option key={n}>{n}</option>
              )}
            </Input>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success">Add</Button>
        <Button color="secondary" onClick={toggle}>Close</Button>
      </ModalFooter>
    </Modal>
  );
};

BasicsModal.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func,
  handleAddBasics: PropTypes.func,
};

const DeckbuilderNavbar = ({ deck }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [basicsModalOpen, setBasicsModalOpen] = useState(false);

  const toggleNavbar = useCallback((event) => {
    event.preventDefault();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const toggleBasicsModal = useCallback((event) => {
    event.preventDefault();
    setBasicsModalOpen(!basicsModalOpen)
  }, [basicsModalOpen]);

  const saveForm = useRef(null);
  const saveDeck = useCallback((event) => {
    event.preventDefault();
    if (saveForm.current) {
      saveForm.current.submit();
    }
  }, [saveForm]);

  return (
    <div className="usercontrols">
      <Navbar expand="md" light>
        <NavbarToggler onClick={toggleNavbar} />
        <Collapse isOpen={isOpen} navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#" onClick={saveDeck}>Save Deck</NavLink>
              <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/editdeck/${deck._id}`}>
                <Input type="hidden" name="draftraw" value={JSON.stringify(deck)} />
              </CSRFForm>
            </NavItem>
            <NavItem>
              <NavLink href="#" onClick={toggleBasicsModal}>Add Basic Lands</NavLink>
              <BasicsModal isOpen={basicsModalOpen} toggle={toggleBasicsModal} />
            </NavItem>
            <NavItem>
              <NavLink href="#">Show Custom Images</NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
    </div>
  );
};

DeckbuilderNavbar.propTypes = {
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  }).isRequired,
};
