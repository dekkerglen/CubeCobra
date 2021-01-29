import React, { useCallback, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';

import DeckDeleteModal from 'components/DeckDeleteModal';

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
import { buildDeck, calculateBasicCounts } from 'drafting/deckutil';

const COLORS = [
  ['White', 'W', 'Plains'],
  ['Blue', 'U', 'Island'],
  ['Black', 'B', 'Swamp'],
  ['Red', 'R', 'Mountain'],
  ['Green', 'G', 'Forest'],
  ['Colorless', 'C', 'Wastes'],
];
const MAX_BASICS = 20;

const BasicsModal = ({ isOpen, toggle, addBasics, deck, draft }) => {
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

  const calculateBasics = useCallback(async () => {
    const main = deck.flat(2);
    const { lands: basics } = calculateBasicCounts(main, draft.cards);
    for (const [basic, count] of Object.entries(basics)) {
      const opts = refs[basic].current.options;
      for (let i = 0; i < opts.length; i++) {
        if (parseInt(opts[i].value, 10) === count) {
          opts[i].selected = true;
        }
      }
    }
  }, [refs, deck, draft]);

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
        <Button color="success" onClick={calculateBasics}>
          Calculate
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
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired))).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({}))).isRequired,
};

const DeckbuilderNavbar = ({
  deck,
  addBasics,
  name,
  description,
  className,
  draft,
  setSideboard,
  setDeck,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [basicsModalOpen, setBasicsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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

  const openDeleteModal = useCallback(() => {
    setDeleteModalOpen(true);
  }, [setDeleteModalOpen]);

  const toggleDeleteModal = useCallback(() => {
    setDeleteModalOpen(!deleteModalOpen);
  }, [deleteModalOpen, setDeleteModalOpen]);

  const stripped = useMemo(() => {
    const res = JSON.parse(JSON.stringify(deck));

    for (const collection of [res.playerdeck, res.playersideboard]) {
      for (const pack of collection) {
        pack.forEach((card, index) => {
          if (!Number.isFinite(card)) {
            pack[index] = deck.cards.findIndex((deckCard) => deckCard.cardID === card.cardID);
          }
        });
      }
    }
    const result = JSON.stringify({
      playersideboard: res.playersideboard,
      playerdeck: res.playerdeck,
    });

    return result;
  }, [deck]);

  const autoBuildDeck = useCallback(async () => {
    const main = deck.playerdeck.flat(2).concat(deck.playersideboard.flat());
    const { sideboard: side, deck: newDeck } = await buildDeck(draft.cards, main, draft.basics);
    setSideboard([side]);
    setDeck([newDeck.slice(0, 8), newDeck.slice(8, 16)]);
  }, [deck, draft, setDeck, setSideboard]);

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
              <Input type="hidden" name="draftraw" value={stripped} />
              <Input type="hidden" name="name" value={JSON.stringify(name)} />
              <Input type="hidden" name="description" value={JSON.stringify(description)} />
            </CSRFForm>
          </NavItem>
          <NavItem>
            <NavLink href="#" onClick={openDeleteModal}>
              Delete Deck
            </NavLink>
            <DeckDeleteModal toggle={toggleDeleteModal} isOpen={deleteModalOpen} deckID={deck._id} cubeID={deck.cube} />
          </NavItem>
          <NavItem>
            <NavLink href="#" onClick={toggleBasicsModal}>
              Add Basic Lands
            </NavLink>
            <BasicsModal
              isOpen={basicsModalOpen}
              toggle={toggleBasicsModal}
              addBasics={addBasics}
              draft={draft}
              deck={deck.playerdeck}
            />
          </NavItem>
          <NavItem>
            <NavLink href="#" onClick={autoBuildDeck}>
              Build for Me
            </NavLink>
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
    cube: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  addBasics: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    basics: PropTypes.shape({}),
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
  }).isRequired,
  setDeck: PropTypes.func.isRequired,
  setSideboard: PropTypes.func.isRequired,
};

DeckbuilderNavbar.defaultProps = {
  className: null,
};

export default DeckbuilderNavbar;
