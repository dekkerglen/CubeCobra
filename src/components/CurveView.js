import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody, Col, Row } from 'reactstrap';

import { getLabels, sortDeep } from 'utils/Sort';
import { fromEntries } from 'utils/Util';

import AutocardListGroup from 'components/AutocardListGroup';
import CubeContext from 'contexts/CubeContext';

const cmc2Labels = getLabels(null, 'Mana Value 2');

function TypeRow({ cardType, group }) {
  const sorted = fromEntries(sortDeep(group, false, 'Alphabetical', 'Mana Value 2'));
  return (
    <>
      <h6>
        {cardType} ({group.length})
      </h6>
      <Row className="row-low-padding mb-2">
        {cmc2Labels.map((cmc) => (
          <div key={cmc} className="col-low-padding" style={{ width: `${100 / cmc2Labels.length}%` }}>
            <AutocardListGroup
              heading={`${cmc} (${(sorted[cmc] || []).length})`}
              cards={sorted[cmc] || []}
              sort="Unsorted"
            />
          </div>
        ))}
      </Row>
    </>
  );
}

TypeRow.propTypes = {
  cardType: PropTypes.string.isRequired,
  group: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

function ColorCard({ color, group }) {
  return (
    <Card className="mb-3">
      <CardHeader>
        <h5 className="mb-0">
          {color} {group.length}
        </h5>
      </CardHeader>
      <CardBody>
        {sortDeep(group, false, 'Alphabetical', 'Creature/Non-Creature').map(([label, cncGroup]) => (
          <TypeRow key={label} cardType={label} group={cncGroup} />
        ))}
      </CardBody>
    </Card>
  );
}

ColorCard.propTypes = {
  color: PropTypes.string.isRequired,
  group: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

function CurveView({ cards, ...props }) {
  const { sortPrimary, cube } = useContext(CubeContext);

  // We call the groups color and type even though they might be other sorts.
  return (
    <Row {...props}>
      <Col>
        {sortDeep(cards, cube.showUnsorted, 'Alphabetical', sortPrimary).map(([color, group]) => (
          <ColorCard key={color} color={color} group={group} />
        ))}
      </Col>
    </Row>
  );
}

CurveView.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default CurveView;
