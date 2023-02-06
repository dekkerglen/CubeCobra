import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Col, DropdownItem, DropdownMenu, DropdownToggle, Form, Label, Row, UncontrolledDropdown } from 'reactstrap';

import useQueryParam from 'hooks/useQueryParam';
import { calculateAsfans } from 'drafting/createdraft';
import { fromEntries } from 'utils/Util';

const AsfanDropdown = ({ cube, cards, setAsfans }) => {
  const [draftFormat, setDraftFormat] = useQueryParam('formatId', -1);
  const [enabled, setEnabled] = useQueryParam('asfans', false);

  const labelText = useMemo(() => {
    if (draftFormat !== null) {
      if (draftFormat < 0) {
        return 'Standard Draft Format';
      }
      return cube.formats[draftFormat].title;
    }
    return '';
  }, [draftFormat, cube]);

  const toggleUseAsfans = useCallback(
    ({ target }) => {
      setEnabled(target.checked);
    },
    [setEnabled],
  );

  useEffect(() => {
    if (!enabled) {
      setAsfans(fromEntries(cards.map((card) => [card.cardID, 1])));
    } else if (draftFormat >= 0) {
      try {
        const asfans = calculateAsfans(cube, draftFormat);
        setAsfans(asfans);
      } catch (e) {
        console.error('Invalid Draft Format', draftFormat, cube.formats[draftFormat], e);
        setAsfans(fromEntries(cards.map((card) => [card.cardID, 0])));
      }
    } else {
      setAsfans(fromEntries(cards.map((card) => [card.cardID, 45 / cards.length])));
    }
  }, [cards, cube, draftFormat, enabled, setAsfans]);

  return (
    <Row>
      <Col xs="12" sm="6">
        <Label>
          <input type="checkbox" checked={enabled} onChange={toggleUseAsfans} />
          Use expected count per player for a non standard draft format
        </Label>
      </Col>
      {draftFormat !== null && (
        <Col xs="12" sm="6">
          <Form className="row row-cols-auto align-items-center gx-1">
            <Col>Draft Format:</Col>
            <Col>
              <UncontrolledDropdown disabled={draftFormat === null} className="ms-2">
                <DropdownToggle caret={draftFormat !== null} color={draftFormat !== null ? 'accent' : 'disabled'}>
                  {labelText}
                </DropdownToggle>
                <DropdownMenu>
                  <DropdownItem onClick={() => setDraftFormat(-1)}>Standard Draft Format</DropdownItem>
                  {cube.formats.length > 0 && <DropdownItem header>Custom Formats</DropdownItem>}
                  {cube.formats.map((format, index) => (
                    <DropdownItem key={format._id} onClick={() => setDraftFormat(index)}>
                      {format.title}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </UncontrolledDropdown>
            </Col>
          </Form>
        </Col>
      )}
    </Row>
  );
};

AsfanDropdown.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
    formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        _id: PropTypes.string.isRequired,
      }),
    ).isRequired,
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  setAsfans: PropTypes.func.isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
};

export default AsfanDropdown;
