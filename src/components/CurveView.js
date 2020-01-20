import React, { Fragment, useEffect } from 'react';

import { Card, CardHeader, CardBody, Col, Container, Row } from 'reactstrap';

import { getLabels, sortIntoGroups } from '../util/Sort';

import AutocardListGroup from './AutocardListGroup';
import SortContext from './SortContext';

const cmc2Labels = getLabels(null, 'CMC2');

const TypeRow = ({ cardType, groups, count, primary }) => (
  <Fragment key={cardType}>
    <h6>
      {cardType} ({count})
    </h6>
    <Row className="row-low-padding mb-2">
      {cmc2Labels.map((cmc) => (
        <div key={cmc} className="col-low-padding" style={{ width: 100 / cmc2Labels.length + '%' }}>
          <AutocardListGroup
            heading={`${cmc} (${(groups[cmc] || []).length})`}
            cards={groups[cmc] || []}
            sort={'Unsorted'}
          />
        </div>
      ))}
    </Row>
  </Fragment>
);

const ColorCard = ({ color, groups, count, typeCounts, primary }) => (
  <Card className="mb-3">
    <CardHeader>
      <h5 className="mb-0">
        {color} {count}
      </h5>
    </CardHeader>
    <CardBody>
      {getLabels(null, 'Creature/Non-Creature')
        .filter((cardType) => groups[cardType])
        .map((cardType) => (
          <TypeRow key={cardType} cardType={cardType} groups={groups[cardType]} count={typeCounts[cardType]} />
        ))}
    </CardBody>
  </Card>
);

const CurveViewRaw = ({ cards, primary, secondary, tertiary, changeSort, ...props }) => {
  // We call the groups color and type even though they might be other sorts.
  let groups = sortIntoGroups(cards, primary);
  let colorCounts = {};
  let typeCounts = {};

  for (let color of Object.keys(groups)) {
    groups[color] = sortIntoGroups(groups[color], 'Creature/Non-Creature');
    colorCounts[color] = 0;
    typeCounts[color] = {};
    for (let cardType of Object.keys(groups[color])) {
      groups[color][cardType] = sortIntoGroups(groups[color][cardType], 'CMC2');
      typeCounts[color][cardType] = 0;
      for (let cmc of Object.keys(groups[color][cardType])) {
        let count = groups[color][cardType][cmc].length;
        colorCounts[color] += count;
        typeCounts[color][cardType] += count;
        groups[color][cardType][cmc].sort((x, y) => {
          if (x.cmc < y.cmc) {
            return -1;
          } else if (x.cmc > y.cmc) {
            return 1;
          } else if (x.details.name < y.details.name) {
            return -1;
          } else if (x.details.name > y.details.name) {
            return 1;
          } else return 0;
        });
      }
    }
  }

  return (
    <Row {...props}>
      <Col>
        {getLabels(cards, primary)
          .filter((color) => groups[color])
          .map((color) => (
            <ColorCard
              key={color}
              color={color}
              groups={groups[color]}
              count={colorCounts[color]}
              typeCounts={typeCounts[color]}
              primary={color}
            />
          ))}
      </Col>
    </Row>
  );
};

const CurveView = SortContext.Wrapped(CurveViewRaw);

export default CurveView;
