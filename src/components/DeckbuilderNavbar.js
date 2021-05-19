import React, { useCallback, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';

import DeckDeleteModal from 'components/DeckDeleteModal';
import CardPropType from 'proptypes/CardPropType';

import { Collapse, Nav, Navbar, NavbarToggler, NavItem, NavLink, Input } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import { buildDeck } from 'drafting/deckutil';
import BasicsModal from 'components/BasicsModal';
import withModal from 'components/WithModal';

const BasicsModalLink = withModal(NavLink, BasicsModal);

const DeckbuilderNavbar = ({ deck, addBasics, name, description, className, setSideboard, setDeck, ...props }) => {
  const { basics } = deck;
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

    for (const collection of [res.playerdeck, res.playersideboard]) {
      for (const row of collection) {
        for (const column of row) {
          column.forEach((card, index) => {
            if (!Number.isFinite(card)) {
              column[index] = deck.cards.findIndex((deckCard) => deckCard.cardID === card.cardID);
            }
          });
        }
      }
    }
    const result = JSON.stringify({
      playersideboard: res.playersideboard,
      playerdeck: res.playerdeck,
    });

    return result;
  }, [deck]);

  const autoBuildDeck = useCallback(async () => {
    const main = deck.seats[0].pickorder;
    const { sideboard: side, deck: newDeck } = await buildDeck(deck.cards, main, basics);
    setSideboard([side.map((col) => col.map((ci) => deck.cards[ci]))]);
    setDeck([
      newDeck.map((col) => col.map((ci) => deck.cards[ci])).slice(0, 8),
      newDeck.map((col) => col.map((ci) => deck.cards[ci])).slice(8, 16),
    ]);
  }, [deck, basics, setDeck, setSideboard]);

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
            <BasicsModalLink
              modalProps={{
                basics,
                addBasics,
                deck: deck.playerdeck.flat(3).map(({ index }) => index),
                cards: deck.cards,
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
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    cube: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(CardPropType.isRequired).isRequired).isRequired)
      .isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
    basics: PropTypes.arrayOf(PropTypes.number.isRequired).isRequired,
  }).isRequired,
  addBasics: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
  setDeck: PropTypes.func.isRequired,
  setSideboard: PropTypes.func.isRequired,
};

DeckbuilderNavbar.defaultProps = {
  className: null,
};

export default DeckbuilderNavbar;
