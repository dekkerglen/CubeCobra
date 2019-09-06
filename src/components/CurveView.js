import React from 'react';

import { Card, CardHeader, CardBody, Col, Container, ListGroup, ListGroupHeading, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from './AutocardListItem';

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
            getLabels(sorts[0]).map(color => !groups[color] ? <></> :
              <Card key={color}>
                <CardHeader>
                  <h5>{color} {colorCounts[color]}</h5>
                </CardHeader>
                <CardBody>
                  {
                    getLabels(sorts[1]).map(cardType => !groups[color][cardType] ? <></> : <>
                      <h6>{cardType} ({typeCounts[color][cardType]})</h6>
                      <Row key={cardType} className="even-cols">
                        {
                          getLabels('CMC2').map(cmc => !groups[color][cardType][cmc] ? <></> :
                            <div key={cmc} className="col-even" style={{ width: 100 / getLabels('CMC2').length + '%' }}>
                              <ListGroup className="list-outline">
                                <ListGroupItem className="list-group-heading">
                                  {cmc} ({groups[color][cardType][cmc].length})
                                </ListGroupItem>
                                {
                                  groups[color][cardType][cmc].map(card =>
                                    (<AutocardListItem key={card.details.name} {...card} />)
                                  )
                                }
                              </ListGroup>
                            </div>
                          )
                        }
                      </Row>
                    </>)
                  }
                </CardBody>
              </Card>
            )
          }
        </Col>
      </Row>
    </Container>
  );
}

export default CurveView;
