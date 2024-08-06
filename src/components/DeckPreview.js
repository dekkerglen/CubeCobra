import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';
import TimeAgo from 'react-timeago';

import DeckDeleteModal from 'components/DeckDeleteModal';
import Username from 'components/Username';
import UserContext from 'contexts/UserContext';
import useKeyHandlers from 'hooks/UseKeyHandlers';

/** 2020-11-17 struesdell:
 *  Pulled constants out of component render so that they are defined only once
 */
const MAX_LENGTH = 35;
const DEFAULT_DECK_NAME = 'Untitled Deck';

/** 2020-11-17 struesdell:
 *  Pulled string truncation logic out of component render and made it more
 *  abstract and reusable. Consider refactoring into shared utilities.
 */
const truncateToLength = (len, s) => {
  if (!s) {
    return '';
  }
  return s.length > len ? `${s.slice(0, len - 3)}...` : s;
};

const DeckPreview = ({ deck, nextURL }) => {
  const user = useContext(UserContext);
  const canEdit = user && (user.id === deck.id || user.id === deck.cubeOwner.id);

  const { date } = deck;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  /** 2020-11-17 struesdell:
   *  Refactored name derivation to take advantage of react.useMemo
   */
  const [fullName, name] = useMemo(
    () =>
      deck && deck.name ? [deck.name, truncateToLength(MAX_LENGTH, deck.name)] : [DEFAULT_DECK_NAME, DEFAULT_DECK_NAME],
    [deck],
  );

  const handleClick = useKeyHandlers(
    useCallback(() => {
      window.location.href = `/cube/deck/${deck.id}`;
    }, [deck.id]),
  );

  const openDeleteModal = (event) => {
    event.stopPropagation();
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
  };

  return (
    <Row className="deck-preview mx-0" {...handleClick}>
      <Col xs={canEdit ? 11 : 12} className="ps-0">
        <h6 className="mb-0 text-muted">
          <a href={`/cube/deck/${deck.id}`} title={fullName}>
            {name}
          </a>{' '}
          by <Username user={deck.owner} /> - <TimeAgo date={date} />
        </h6>
      </Col>
      {canEdit && (
        <Col xs={1} className="pe-0">
          <button
            type="button"
            className="btn-close"
            style={{
              fontSize: '.8rem',
              textAlign: 'center',
              width: '19px',
              height: '19px',
              paddingBottom: '2px',
              lineHeight: '17px',
              border: '1px solid rgba(0,0,0,.5)',
              float: 'right',
            }}
            onClick={openDeleteModal}
          >
            <DeckDeleteModal
              toggle={closeDeleteModal}
              isOpen={deleteModalOpen}
              deckID={deck.id}
              cubeID={deck.cube}
              nextURL={nextURL}
            />
          </button>
        </Col>
      )}
    </Row>
  );
};

DeckPreview.propTypes = {
  deck: DeckPropType.isRequired,
  nextURL: PropTypes.string,
};

DeckPreview.defaultProps = {
  nextURL: null,
};

export default DeckPreview;
