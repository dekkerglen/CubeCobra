import React from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import { getLabels, sortIntoGroups } from '../utils/Sort';

import AutocardListItem from './AutocardListItem';
import SortContext from './SortContext';

const CompareGroup = ({ heading, both, onlyA, onlyB }) => {
  let bothCmc = sortIntoGroups(both, 'CMC');
  let onlyACmc = sortIntoGroups(onlyA, 'CMC');
  let onlyBCmc = sortIntoGroups(onlyB, 'CMC');

  return (
    <ListGroup className="list-outline">
      <ListGroupItem className="list-group-heading px-0">
        {heading}
        <Row noGutters>
          <Col>({both.length})</Col>
          <Col>({onlyA.length})</Col>
          <Col>({onlyB.length})</Col>
        </Row>
      </ListGroupItem>
      {getLabels(null, 'CMC')
        .filter((cmc) => onlyACmc[cmc] || bothCmc[cmc] || onlyBCmc[cmc])
        .map((cmc) => (
          <Row key={cmc} noGutters className="cmc-group">
            {[[bothCmc, 'both'], [onlyACmc, 'a'], [onlyBCmc, 'b']].map(([cards, key]) => (
              <Col xs="4" key={key}>
                {(cards[cmc] || []).map((card, index) => (
                  <AutocardListItem key={index} card={card} />
                ))}
              </Col>
            ))}
          </Row>
        ))}
    </ListGroup>
  );
};

const CompareViewRaw = ({ cards, primary, secondary, both, onlyA, onlyB, ...props }) => {
  let columns = sortIntoGroups(cards, primary);
  let columnCounts = {};
  let bothCounts = {};
  let onlyACounts = {};
  let onlyBCounts = {};

  let both_copy = both.slice(0);
  let only_a_copy = onlyA.slice(0);
  let only_b_copy = onlyB.slice(0);

  for (let columnLabel of Object.keys(columns)) {
    let onlyACount = 0,
      onlyBCount = 0,
      bothCount = 0;
    for (let card of columns[columnLabel]) {
      if (both_copy.includes(card.details.name)) {
        bothCount++;
        both_copy.splice(both_copy.indexOf(card.details.name), 1);
      } else if (only_a_copy.includes(card.details.name)) {
        onlyACount++;
        only_a_copy.splice(only_a_copy.indexOf(card.details.name), 1);
      } else if (only_b_copy.includes(card.details.name)) {
        onlyBCount++;
        only_b_copy.splice(only_b_copy.indexOf(card.details.name), 1);
      }
    }

    columnCounts[columnLabel] = columns[columnLabel].length;
    bothCounts[columnLabel] = bothCount;
    onlyACounts[columnLabel] = onlyACount;
    onlyBCounts[columnLabel] = onlyBCount;
    columns[columnLabel] = sortIntoGroups(columns[columnLabel], secondary);
  }

  const bothCopy = both.slice(0);
  const onlyACopy = onlyA.slice(0);
  const onlyBCopy = onlyB.slice(0);

  return (
    <>
      {getLabels(cards, primary)
        .filter((columnLabel) => columns[columnLabel])
        .map((columnLabel) => {
          let column = columns[columnLabel];
          return (
            <Row key={columnLabel} {...props}>
              <Col xs="12" md="10" lg="8" className="mx-auto">
                <div className="compare-header pt-2">
                  <Row>
                    <Col>
                      <h6 className="text-center">{columnLabel}</h6>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs="4">
                      <h6 className="text-center">
                        In Both Cubes
                        <br />({bothCounts[columnLabel]})
                      </h6>
                    </Col>
                    <Col xs="4">
                      <h6 className="text-center">
                        Only in Base Cube
                        <br />({onlyACounts[columnLabel]})
                      </h6>
                    </Col>
                    <Col xs="4">
                      <h6 className="text-center">
                        Only in Comparison Cube
                        <br />({onlyBCounts[columnLabel]})
                      </h6>
                    </Col>
                  </Row>
                </div>
                {getLabels(column, secondary)
                  .filter((label) => column[label])
                  .map((label) => {
                    let group = column[label];
                    let bothGroup = [],
                      onlyAGroup = [],
                      onlyBGroup = [];

                    for (let card of group) {
                      if (bothCopy.includes(card.details.name)) {
                        bothGroup.push(card);
                        bothCopy.splice(bothCopy.indexOf(card.details.name), 1);
                      } else if (onlyACopy.includes(card.details.name)) {
                        onlyAGroup.push(card);
                        onlyACopy.splice(onlyACopy.indexOf(card.details.name), 1);
                      } else if (onlyBCopy.includes(card.details.name)) {
                        onlyBGroup.push(card);
                        onlyBCopy.splice(onlyBCopy.indexOf(card.details.name), 1);
                      }
                    }

                    return (
                      <CompareGroup
                        key={label}
                        heading={label}
                        both={bothGroup}
                        onlyA={onlyAGroup}
                        onlyB={onlyBGroup}
                      />
                    );
                  })}
              </Col>
            </Row>
          );
        })}
    </>
  );
};

const CompareView = (props) => (
  <SortContext.Consumer>
    {({ primary, secondary }) => <CompareViewRaw primary={primary} secondary={secondary} {...props} />}
  </SortContext.Consumer>
);

export default CompareView;
