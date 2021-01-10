import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Col, DropdownItem, DropdownMenu, DropdownToggle, Form, Label, Row, UncontrolledDropdown } from 'reactstrap';

import useQueryParam from 'hooks/useQueryParam';
import { calculateAsfans } from 'utils/draftutil';
import { fromEntries } from 'utils/Util';

const AsfanDropdown = ({ cube, defaultFormatId, setAsfans, alwaysUseAsfans }) => {
  const [draftFormat, setDraftFormat] = useQueryParam('formatId', defaultFormatId);

  const labelText = useCallback(() => {
    if (draftFormat !== null) {
      if (draftFormat < 0) {
        return 'Standard Draft Format';
      }
      return cube.draft_formats[draftFormat].title;
    }
    return 'Count';
  }, [draftFormat, cube]);
  const toggleUseAsfans = useCallback(() => {
    if (draftFormat === null) setDraftFormat(defaultFormatId);
    else setDraftFormat(null);
  }, [draftFormat, setDraftFormat, defaultFormatId]);

  useEffect(() => {
    if (draftFormat !== null) {
      try {
        const asfans = calculateAsfans(cube, draftFormat);
        setAsfans(asfans);
      } catch (e) {
        console.error('Invalid Draft Format', draftFormat, cube.draft_formats[draftFormat], e);
        setAsfans(fromEntries(cube.cards.map((card) => [card.cardID, 0])));
      }
    } else {
      setAsfans(fromEntries(cube.cards.map((card) => [card.cardID, 1])));
    }
  }, [cube, draftFormat, setAsfans]);

  return (
    <Row>
      {!alwaysUseAsfans && (
        <Col xs="12" sm="6">
          <Label>
            <input type="checkbox" checked={draftFormat !== null} onChange={toggleUseAsfans} /> Use expected count per
            player in a draft format instead of card count.
          </Label>
        </Col>
      )}
      {draftFormat !== null && (
        <Col xs="12" sm="6">
          <Form inline>
            Draft Format:
            <UncontrolledDropdown disabled={draftFormat === null} className="ml-2">
              <DropdownToggle caret={draftFormat !== null} color={draftFormat !== null ? 'success' : 'disabled'}>
                {labelText}
              </DropdownToggle>
              <DropdownMenu>
                <DropdownItem onClick={() => setDraftFormat(-1)}>Standard Draft Format</DropdownItem>
                {cube.draft_formats.length > 0 && <DropdownItem header>Custom Formats</DropdownItem>}
                {cube.draft_formats.map((format, index) => (
                  <DropdownItem key={format._id} onClick={() => setDraftFormat(index)}>
                    {format.title}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </UncontrolledDropdown>
          </Form>
        </Col>
      )}
    </Row>
  );
};

AsfanDropdown.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
    draft_formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        _id: PropTypes.string.isRequired,
      }),
    ).isRequired,
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  defaultFormatId: PropTypes.number,
  setAsfans: PropTypes.func.isRequired,
  alwaysUseAsfans: PropTypes.bool,
};
AsfanDropdown.defaultProps = {
  alwaysUseAsfans: false,
  defaultFormatId: -1,
};

export default AsfanDropdown;
