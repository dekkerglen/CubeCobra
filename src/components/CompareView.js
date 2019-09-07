import React from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from './AutocardListItem';

const CompareGroup = ({ heading, onlyA, both, onlyB }) => {
  let onlyACmc = sortIntoGroups(onlyA, "CMC");
  let bothCmc = sortIntoGroups(both, "CMC");
  let onlyBCmc = sortIntoGroups(onlyB, "CMC");

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
      {
        getLabels("CMC").filter(cmc => onlyACmc[cmc] || bothCmc[cmc] || onlyBCmc[cmc]).map(cmc =>
          <Row key={cmc} noGutters className="cmc-group">
            <Col xs="4">{(bothCmc[cmc] || []).map(card => <AutocardListItem key={card.cardID} card={card} />)}</Col>
            <Col xs="4">{(onlyACmc[cmc] || []).map(card => <AutocardListItem key={card.cardID} card={card} />)}</Col>
            <Col xs="4">{(onlyBCmc[cmc] || []).map(card => <AutocardListItem key={card.cardID} card={card} />)}</Col>
          </Row>
        )
      }
    </ListGroup>
  );
}

const CompareView = ({ cards, sorts, onlyA, both, onlyB, ...props }) => {
  let columns = sortIntoGroups(cards, sorts[0]);
  let columnCounts = {};
  let onlyACounts = {};
  let bothCounts = {};
  let onlyBCounts = {};
  for (let columnLabel of Object.keys(columns)) {
    columnCounts[columnLabel] = columns[columnLabel].length;
    onlyACounts[columnLabel] = columns[columnLabel].filter(card => onlyA.has(card.details.name)).length;
    bothCounts[columnLabel] = columns[columnLabel].filter(card => both.has(card.details.name)).length;
    onlyBCounts[columnLabel] = columns[columnLabel].filter(card => onlyB.has(card.details.name)).length;
    columns[columnLabel] = sortIntoGroups(columns[columnLabel], sorts[1]);
  }
  console.log(onlyACounts);

  return <>
    {
      getLabels(sorts[0]).filter(columnLabel => columns[columnLabel]).map(columnLabel => {
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
                    <h6 className="text-center">In Both Cubes<br />({bothCounts[columnLabel]})</h6>
                  </Col>
                  <Col xs="4">
                    <h6 className="text-center">Only in Base Cube<br />({onlyACounts[columnLabel]})</h6>
                  </Col>
                  <Col xs="4">
                    <h6 className="text-center">Only in Comparison Cube<br />({onlyBCounts[columnLabel]})</h6>
                  </Col>
                </Row>
              </div>
              {
                getLabels(sorts[1]).filter(label => column[label]).map(label => {
                  let group = column[label];
                  let onlyAGroup = group.filter(card => onlyA.has(card.details.name));
                  let bothGroup = group.filter(card => both.has(card.details.name));
                  let onlyBGroup = group.filter(card => onlyB.has(card.details.name));
                  return (
                    <CompareGroup
                      key={label}
                      heading={label}
                      onlyA={onlyAGroup}
                      both={bothGroup}
                      onlyB={onlyBGroup}
                    />
                  );
                })
              }
            </Col>
          </Row>
        );
      })
    }
  </>;
}

export default CompareView;
