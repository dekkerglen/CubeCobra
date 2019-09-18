import React, { Fragment } from 'react';

import { Card, CardHeader, CardBody, Col, Container, Row } from 'reactstrap';

import AutocardListGroup from './AutocardListGroup';
import SortContext from './SortContext';

const TypeRow = ({ cardType, groups, count, primary }) => (
  <Fragment key={cardType}>
    <Row className="mt-2">
      <h6 className="ml-1">{cardType} ({count})</h6>
    </Row>
    <Row className="even-cols">
      {
        getLabels('CMC2').map(cmc =>
          <div key={cmc} className="col-even" style={{ width: 100 / getLabels('CMC2').length + '%' }}>
            <AutocardListGroup
              heading={`${cmc} (${(groups[cmc] || []).length})`}
              cards={groups[cmc] || []}
              primary={primary}
              secondary={cardType}
              tertiary={cmc}
            />
          </div>
        )
      }
    </Row>
  </Fragment>
);

const ColorCard = ({ color, groups, count, typeCounts, primary }) => (
  <Card>
    <CardHeader>
      <h5>{color} {count}</h5>
    </CardHeader>
    <CardBody>
      {
        getLabels('CNC').filter(cardType => groups[cardType]).map(cardType =>
          <TypeRow
            key={cardType}
            cardType={cardType}
            groups={groups[cardType]}
            count={typeCounts[cardType]}
            primary={primary}
          />
        )
      }
    </CardBody>
  </Card>
);

const CurveViewRaw = ({ cards, primary, ...props }) => {
  // We call the groups color and type even though they might be other sorts.
  let groups = sortIntoGroups(cards, primary);
  let colorCounts = {};
  let typeCounts = {};

  for (let color of Object.keys(groups)) {
    groups[color] = sortIntoGroups(groups[color], 'CNC');
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
    <Row className="mt-3" {...props}>
      <Col>
        {
          getLabels(primary).filter(color => groups[color]).map(color => (
            <ColorCard
              key={color}
              color={color}
              groups={groups[color]}
              count={colorCounts[color]}
              typeCounts={typeCounts[color]}
              primary={color}
            />
          ))
        }
      </Col>
    </Row>
  );
}

const CurveView = SortContext.Wrapped(CurveViewRaw);

export default CurveView;
