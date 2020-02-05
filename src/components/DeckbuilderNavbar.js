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

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';

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
  for (const [, , basic] of COLORS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    refs[basic] = useRef();
  }

  const handleAddBasics = useCallback(() => {
    const numBasics = {};
    for (const basic of Object.keys(refs)) {
      numBasics[basic] = parseInt(refs[basic].current.value, 10);
    }
    addBasics(numBasics);
    toggle();
  }, [addBasics, toggle, refs]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="sm">
      <ModalHeader toggle={toggle}>Add Basic Lands</ModalHeader>
      <ModalBody>
        {COLORS.map(([long, short, basic]) => (
          <Form key={short} className="mb-1" inline>
            <img
              src={`/content/symbols/${short.toLowerCase()}.png`}
              alt={long}
              title={long}
              className="mr-1 mana-symbol"
            />
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
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  addBasics: PropTypes.func.isRequired,
};

const DeckbuilderNavbar = ({ deck, addBasics, name, description, className, ...props }) => {
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
      if (event) {
        event.preventDefault();
      }
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
    <Navbar expand="md" light className={`usercontrols ${className}`} {...props}>
      <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem>
            <NavLink href="#" onClick={saveDeck}>
              Save Deck
            </NavLink>
            <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/editdeck/${deck._id}`}>
              <Input type="hidden" name="draftraw" value={JSON.stringify(deck)} />
              <Input type="hidden" name="name" value={JSON.stringify(name)} />
              <Input type="hidden" name="description" value={JSON.stringify(description)} />
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
  );
};

DeckbuilderNavbar.propTypes = {
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  }).isRequired,
  addBasics: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
};

DeckbuilderNavbar.defaultProps = {
  className: null,
};

export default DeckbuilderNavbar;
