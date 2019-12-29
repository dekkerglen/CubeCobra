import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Collapse,
  Form,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  Navbar,
  NavbarToggler,
  NavItem,
  NavLink,
  Input,
} from 'reactstrap';

import CSRFForm from './CSRFForm';
import CustomImageToggler from './CustomImageToggler';

const COLORS = [
  ['White', 'W', 'Plains'],
  ['Blue', 'U', 'Island'],
  ['Black', 'B', 'Swamp'],
  ['Red', 'R', 'Mountain'],
  ['Green', 'G', 'Forest'],
];
const MAX_BASICS = 20;

const BasicsModal = ({ isOpen, toggle, addBasics }) => {
  const refs = {};
  for (const [long, short, basic] of COLORS) {
    refs[basic] = useRef();
  }

  const handleAddBasics = useCallback(() => {
    const numBasics = {};
    for (const basic in refs) {
      numBasics[basic] = parseInt(refs[basic].current.value);
    }
    addBasics(numBasics);
    toggle();
  }, [addBasics, toggle]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="sm">
      <ModalHeader toggle={toggle}>Add Basic Lands</ModalHeader>
      <ModalBody>
        {COLORS.map(([long, short, basic]) => (
          <Form key={short} className="mb-1" inline>
            <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={long} title={long} className="mr-1" />
            <Input type="select" name={long} defaultValue={0} innerRef={refs[basic]}>
              {Array.from(new Array(MAX_BASICS).keys()).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Input>
          </Form>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success" onClick={handleAddBasics}>
          Add
        </Button>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

BasicsModal.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func,
  handleAddBasics: PropTypes.func,
};

const DeckbuilderNavbar = ({ deck, addBasics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [basicsModalOpen, setBasicsModalOpen] = useState(false);

  const toggleNavbar = useCallback(
    (event) => {
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen],
  );

  const toggleBasicsModal = useCallback(
    (event) => {
      event && event.preventDefault();
      setBasicsModalOpen(!basicsModalOpen);
    },
    [basicsModalOpen],
  );

  const saveForm = useRef(null);
  const saveDeck = useCallback(
    (event) => {
      event.preventDefault();
      if (saveForm.current) {
        saveForm.current.submit();
      }
    },
    [saveForm],
  );

  return (
    <div className="usercontrols">
      <Navbar expand="md" light>
        <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
        <Collapse isOpen={isOpen} navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#" onClick={saveDeck}>
                Save Deck
              </NavLink>
              <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/editdeck/${deck._id}`}>
                <Input type="hidden" name="draftraw" value={JSON.stringify(deck)} />
              </CSRFForm>
            </NavItem>
            <NavItem>
              <NavLink href="#" onClick={toggleBasicsModal}>
                Add Basic Lands
              </NavLink>
              <BasicsModal isOpen={basicsModalOpen} toggle={toggleBasicsModal} addBasics={addBasics} />
            </NavItem>
            <CustomImageToggler />
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

export default DeckbuilderNavbar;
