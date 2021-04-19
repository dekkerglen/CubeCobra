import React, { useCallback, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';

import DeckDeleteModal from 'components/DeckDeleteModal';
import CardPropType from 'proptypes/CardPropType';

import { Collapse, Nav, Navbar, NavbarToggler, NavItem, NavLink, Input } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import BasicsModal from 'components/BasicsModal';
import { buildDeck } from 'utils/Draft';
import withModal from 'components/WithModal';

const BasicsModalLink = withModal(NavLink, BasicsModal);

const DeckbuilderNavbar = ({
  deck,
  basics,
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const toggleNavbar = useCallback(
    (event) => {
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen],
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

    for (const seat of res.seats) {
      for (const collection of [seat.deck, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            delete card.details;
          }
        }
      }
      if (seat.pickorder) {
        for (const card of seat.pickorder) {
          delete card.details;
        }
      }
    }

    return res;
  }, [deck]);

  const autoBuildDeck = useCallback(async () => {
    const main = deck.playerdeck.flat(2).concat(deck.playersideboard.flat());
    const { sideboard: side, deck: newDeck } = await buildDeck(main, basics);
    setSideboard([side]);
    setDeck([newDeck.slice(0, 8), newDeck.slice(8, 16)]);
  }, [deck, setDeck, setSideboard, basics]);

  return (
    <Navbar expand="md" light className={`usercontrols ${className}`} {...props}>
      <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem>
            <NavLink href="#" onClick={saveDeck}>
              Save Deck
            </NavLink>
            <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/deck/editdeck/${deck._id}`}>
              <Input type="hidden" name="draftraw" value={JSON.stringify(stripped)} />
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
            <BasicsModalLink
              modalProps={{
                basics,
                addBasics,
                draft,
                deck: deck.playerdeck,
              }}
            >
              Add Basic Lands
            </BasicsModalLink>
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
  basics: PropTypes.arrayOf(CardPropType).isRequired,
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    cube: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  }).isRequired,
  addBasics: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({})))).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  }).isRequired,
  setDeck: PropTypes.func.isRequired,
  setSideboard: PropTypes.func.isRequired,
};

DeckbuilderNavbar.defaultProps = {
  className: null,
};

export default DeckbuilderNavbar;
