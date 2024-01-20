/* eslint-disable react/no-array-index-key */
import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import { getLabels, sortIntoGroups } from 'utils/Sort';

import AutocardListItem from 'components/AutocardListItem';
import CardPropType from 'proptypes/CardPropType';
import CubeContext from 'contexts/CubeContext';
import withCardModal from 'components/WithCardModal';

const CardModalLink = withCardModal(AutocardListItem);

const CompareGroup = ({ heading, both, onlyA, onlyB }) => {
  const bothCmc = sortIntoGroups(both, 'Mana Value');
  const onlyACmc = sortIntoGroups(onlyA, 'Mana Value');
  const onlyBCmc = sortIntoGroups(onlyB, 'Mana Value');

  return (
    <ListGroup className="list-outline">
      <ListGroupItem className="list-group-heading px-0">
        {heading}
        <Row className="g-0">
          <Col>({both.length})</Col>
          <Col>({onlyA.length})</Col>
          <Col>({onlyB.length})</Col>
        </Row>
      </ListGroupItem>
      {getLabels(null, 'Mana Value')
        .filter((cmc) => onlyACmc[cmc] || bothCmc[cmc] || onlyBCmc[cmc])
        .map((cmc) => (
          <Row key={cmc} className="cmc-group g-0">
            {[
              [bothCmc, 'both'],
              [onlyACmc, 'a'],
              [onlyBCmc, 'b'],
            ].map(([cards, key]) => (
              <Col xs="4" key={key}>
                {(cards[cmc] || []).map((card, index) => (
                  <CardModalLink
                    key={card.index}
                    card={card}
                    altClick={() => {
                      window.open(`/tool/card/${card.cardID}`);
                    }}
                    className={index === 0 ? 'cmc-group' : undefined}
                    modalProps={{
                      card,
                    }}
                  />
                ))}
              </Col>
            ))}
          </Row>
        ))}
    </ListGroup>
  );
};

CompareGroup.propTypes = {
  heading: PropTypes.string.isRequired,
  both: PropTypes.arrayOf(CardPropType).isRequired,
  onlyA: PropTypes.arrayOf(CardPropType).isRequired,
  onlyB: PropTypes.arrayOf(CardPropType).isRequired,
};

const CompareView = ({ cards, both, onlyA, onlyB }) => {
  const { sortPrimary, sortSecondary, cube } = useContext(CubeContext);

  const columns = sortIntoGroups(cards, sortPrimary, cube.showUnsorted);
  const columnCounts = {};
  const bothCounts = { total: 0 };
  const onlyACounts = { total: 0 };
  const onlyBCounts = { total: 0 };

  const bothCopyTemp = both.slice(0);
  const onlyACopyTemp = onlyA.slice(0);
  const onlyBCopyTemp = onlyB.slice(0);

  for (const columnLabel of Object.keys(columns)) {
    let onlyACount = 0;
    let onlyBCount = 0;
    let bothCount = 0;
    for (const card of columns[columnLabel]) {
      if (bothCopyTemp.includes(card.details.oracle_id)) {
        bothCount += 1;
        bothCopyTemp.splice(bothCopyTemp.indexOf(card.details.oracle_id), 1);
      } else if (onlyACopyTemp.includes(card.details.oracle_id)) {
        onlyACount += 1;
        onlyACopyTemp.splice(onlyACopyTemp.indexOf(card.details.oracle_id), 1);
      } else if (onlyBCopyTemp.includes(card.details.oracle_id)) {
        onlyBCount += 1;
        onlyBCopyTemp.splice(onlyBCopyTemp.indexOf(card.details.oracle_id), 1);
      }
    }

    columnCounts[columnLabel] = columns[columnLabel].length;
    bothCounts[columnLabel] = bothCount;
    bothCounts.total += bothCount;
    onlyACounts[columnLabel] = onlyACount;
    onlyACounts.total += onlyACount;
    onlyBCounts[columnLabel] = onlyBCount;
    onlyBCounts.total += onlyBCount;
    columns[columnLabel] = sortIntoGroups(columns[columnLabel], sortSecondary, cube.showUnsorted);
  }
  const bothCopy = both.slice(0);
  const onlyACopy = onlyA.slice(0);
  const onlyBCopy = onlyB.slice(0);

  return (
    <>
      {
        <div className="compare-header pt-2">
          <Row>
            <Col>
              <h6 className="text-center">Total</h6>
            </Col>
          </Row>
          <Row>
            <Col xs="4">
              <h6 className="text-center">
                In Both cubes
                <br />({bothCounts.total})
              </h6>
            </Col>
            <Col xs="4">
              <h6 className="text-center">
                Only in Base Cube
                <br />({onlyACounts.total})
              </h6>
            </Col>
            <Col xs="4">
              <h6 className="text-center">
                Only in Comparison Cube
                <br />({onlyBCounts.total})
              </h6>
            </Col>
          </Row>
        </div>
      }
      {getLabels(cards, sortPrimary, cube.showUnsorted)
        .filter((columnLabel) => columns[columnLabel])
        .map((columnLabel) => {
          const column = columns[columnLabel];
          return (
            <Row key={columnLabel}>
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
                        In Both cubes
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
                {getLabels(Object.values(column).flat(), sortSecondary, cube.showUnsorted)
                  .filter((label) => column[label])
                  .map((label) => {
                    const group = column[label];
                    const bothGroup = [];
                    const onlyAGroup = [];
                    const onlyBGroup = [];

                    for (const card of group) {
                      if (bothCopy.includes(card.details.oracle_id)) {
                        bothGroup.push(card);
                        bothCopy.splice(bothCopy.indexOf(card.details.oracle_id), 1);
                      } else if (onlyACopy.includes(card.details.oracle_id)) {
                        onlyAGroup.push(card);
                        onlyACopy.splice(onlyACopy.indexOf(card.details.oracle_id), 1);
                      } else if (onlyBCopy.includes(card.details.oracle_id)) {
                        onlyBGroup.push(card);
                        onlyBCopy.splice(onlyBCopy.indexOf(card.details.oracle_id), 1);
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

CompareView.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  onlyA: PropTypes.arrayOf(CardPropType).isRequired,
  onlyB: PropTypes.arrayOf(CardPropType).isRequired,
  both: PropTypes.arrayOf(CardPropType).isRequired,
};

export default CompareView;
