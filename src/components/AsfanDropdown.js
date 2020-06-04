import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Col, DropdownItem, DropdownMenu, DropdownToggle, Form, Label, Row, UncontrolledDropdown } from 'reactstrap';

import useToggle from 'hooks/UseToggle';
import { calculateAsfans } from 'utils/draftutil';
import Query from 'utils/Query';
import { fromEntries } from 'utils/Util';

const AsfanDropdown = ({ cube, defaultFormatId, setAsfans }) => {
  const [useAsfans, toggleUseAsfans, enableUseAsfans, disableUseAsfans] = useToggle(!!defaultFormatId);
  const [draftFormat, setDraftFormat] = useState(defaultFormatId ?? cube.defaultDraftFormat ?? -1);
  const didMountRef = useRef(false);

  const labelText = () => {
    if (useAsfans) {
      if (draftFormat < 0) {
        return 'Standard Draft Format';
      }
      return cube.draft_formats[draftFormat].title;
    }
    return 'Count';
  };

  useEffect(() => {
    if (useAsfans) {
      try {
        const asfans = calculateAsfans(cube, draftFormat);
        console.log('asfans preset', asfans);
        setAsfans(asfans);
      } catch (e) {
        console.error('Invalid Draft Format', draftFormat, cube.draft_formats[draftFormat], e);
        setAsfans(fromEntries(cube.cards.map((card) => [card.cardID, 0])));
      }
    } else {
      setAsfans(fromEntries(cube.cards.map((card) => [card.cardID, 1])));
    }
  }, [useAsfans, cube, draftFormat, setAsfans]);

  useEffect(() => {
    if (didMountRef.current) {
      if (useAsfans) {
        Query.set('formatId', draftFormat);
      } else {
        Query.del('formatId');
      }
    } else {
      const queryFormat = Query.get('formatId');
      if (queryFormat || queryFormat === 0) {
        enableUseAsfans();
        setDraftFormat(queryFormat);
      } else {
        disableUseAsfans();
      }
      didMountRef.current = true;
    }
  }, [draftFormat, useAsfans, enableUseAsfans, disableUseAsfans, setDraftFormat]);

  return (
    <Row>
      <Col>
        <Label>
          <input type="checkbox" checked={useAsfans} onChange={toggleUseAsfans} /> Use expected count per player in a
          draft format instead of card count.
        </Label>
      </Col>
      <Col>
        <Form inline>
          Draft Format:
          <UncontrolledDropdown disabled={!useAsfans} className="ml-2">
            <DropdownToggle caret={useAsfans} color={useAsfans ? 'success' : 'disabled'}>
              {labelText(useAsfans)}
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
};
AsfanDropdown.defaultProps = {
  defaultFormatId: null,
};

export default AsfanDropdown;
