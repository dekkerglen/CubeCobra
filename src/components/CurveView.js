import React, { Fragment } from 'react';

import { Card, CardHeader, CardBody, Col, Container, Row } from 'reactstrap';

import AutocardListGroup from './AutocardListGroup';

const TypeRow = ({ cardType, groups, count }) => (
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
            />
          </div>
        )
      }
    </Row>
  </Fragment>
);

const ColorCard = ({ color, groups, count, typeCounts }) => (
  <Card>
    <CardHeader>
      <h5>{color} {count}</h5>
    </CardHeader>
    <CardBody>
      {
        getLabels(sorts[1]).filter(cardType => groups[cardType]).map(cardType =>
          <TypeRow
            key={cardType}
            cardType={cardType}
            groups={groups[cardType]}
            count={typeCounts[cardType]}
          />
        )
      }
    </CardBody>
  </Card>
);

const CurveView = ({ cards, ...props }) => {
  sorts[0] = document.getElementById('primarySortSelect').value || 'Color Category';
  sorts[1] = document.getElementById('secondarySortSelect').value || 'Types-Multicolor';

  // We call the groups color and type even though they might be other sorts.
  let groups = sortIntoGroups(cards, sorts[0]);
  let colorCounts = {};
  let typeCounts = {};

  for (let color of Object.keys(groups)) {
    groups[color] = sortIntoGroups(groups[color], sorts[1]);
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
    <Container {...props}>
      <Row>
        <Col>
          {
            getLabels(sorts[0]).filter(color => groups[color]).map(color => (
              <ColorCard
                key={color}
                color={color}
                groups={groups[color]}
                count={colorCounts[color]}
                typeCounts={typeCounts[color]}
              />
            ))
          }
        </Col>
      </Row>
    </Container>
  );
}

export default CurveView;
