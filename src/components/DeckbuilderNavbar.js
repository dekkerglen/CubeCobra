import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Collapse, Input, Nav, Navbar, NavbarToggler, NavItem, NavLink } from 'reactstrap';

import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';

import BasicsModal from 'components/BasicsModal';
import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckDeleteModal from 'components/DeckDeleteModal';
import withModal from 'components/WithModal';
import { cardsAreEquivalent } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';

const DeleteDeckModalLink = withModal(NavLink, DeckDeleteModal);
const BasicsModalLink = withModal(NavLink, BasicsModal);

const DeckbuilderNavbar = ({
  deck,
  addBasics,
  name,
  description,
  className,
  setSideboard,
  setDeck,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  seat,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);

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

  const stripped = useMemo(() => {
    const res = JSON.parse(JSON.stringify(deck));

    for (const collection of [res.mainboard, res.sideboard]) {
      for (const row of collection) {
        for (const column of row) {
          column.forEach((card, index) => {
            if (!Number.isFinite(card)) {
              column[index] = deck.cards.findIndex((deckCard) => cardsAreEquivalent(deckCard, card));
            }
          });
        }
      }
    }

    return {
      sideboard: res.sideboard,
      mainboard: res.mainboard,
    };
  }, [deck]);

  const autoBuildDeck = useCallback(async () => {
    const response = await csrfFetch('/cube/api/deckbuild', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool: [
          ...deck.mainboard.flat(3).map(({ index }) => index),
          ...deck.sideboard.flat(3).map(({ index }) => index),
        ].map((index) => deck.cards[index].details),
        basics: deck.basics.map((index) => deck.cards[index].details),
      }),
    });

    const json = await response.json();

    if (json.success === 'true') {
      const pool = [
        ...deck.mainboard.flat(3).map(({ index }) => index),
        ...deck.sideboard.flat(3).map(({ index }) => index),
      ];
      const newMainboard = [];

      for (const oracle of json.mainboard) {
        const poolIndex = pool.findIndex((cardindex) => deck.cards[cardindex].details.oracle_id === oracle);
        if (poolIndex === -1) {
          // try basics
          const basicsIndex = deck.basics.findIndex((cardindex) => deck.cards[cardindex].details.oracle_id === oracle);
          if (basicsIndex !== -1) {
            newMainboard.push(deck.basics[basicsIndex]);
          } else {
            console.error(`Could not find card ${oracle} in pool or basics`);
          }
        } else {
          newMainboard.push(pool[poolIndex]);
          pool.splice(poolIndex, 1);
        }
      }

      // format mainboard
      const formattedMainboard = [[], []];
      const formattedSideboard = [[]];
      for (let i = 0; i < 8; i++) {
        formattedMainboard[0].push([]);
        formattedMainboard[1].push([]);
        formattedSideboard[0].push([]);
      }

      for (const index of newMainboard) {
        const card = deck.cards[index];
        const row = card.details.type.includes('Creature') || card.details.type.includes('Basic') ? 0 : 1;
        const column = Math.max(0, Math.min(card.details.cmc, 7));

        formattedMainboard[row][column].push(deck.cards[index]);
      }

      for (const index of pool) {
        if (!deck.basics.includes(index)) {
          const card = deck.cards[index];
          const column = Math.max(0, Math.min(card.details.cmc, 7));

          formattedSideboard[0][column].push(deck.cards[index]);
        }
      }

      setDeck(formattedMainboard);
      setSideboard(formattedSideboard);
    } else {
      console.error(json);
    }
  }, [deck.mainboard, deck.sideboard, deck.basics, deck.cards, setDeck, setSideboard]);

  return (
    <Navbar expand="md" light className={`usercontrols ${className}`} {...props}>
      <NavbarToggler onClick={toggleNavbar} className="ms-auto" />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem>
            <NavLink href="#" onClick={saveDeck}>
              Save Deck
            </NavLink>
            <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/deck/editdeck/${deck.id}`}>
              <Input type="hidden" name="main" value={JSON.stringify(stripped.mainboard)} />
              <Input type="hidden" name="side" value={JSON.stringify(stripped.sideboard)} />
              <Input type="hidden" name="title" value={name} />
              <Input type="hidden" name="description" value={description} />
            </CSRFForm>
          </NavItem>
          <NavItem>
            <DeleteDeckModalLink modalprops={{ deckID: deck.id, cubeID: deck.cube }}>Delete Deck</DeleteDeckModalLink>
          </NavItem>
          <NavItem>
            <BasicsModalLink
              modalprops={{
                basics: deck.basics,
                addBasics,
                deck: deck.mainboard.flat(3).map(({ index }) => index),
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
  deck: DeckPropType.isRequired,
  addBasics: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
  setDeck: PropTypes.func.isRequired,
  setSideboard: PropTypes.func.isRequired,
  seat: PropTypes.number.isRequired,
};

DeckbuilderNavbar.defaultProps = {
  className: null,
};

export default DeckbuilderNavbar;
