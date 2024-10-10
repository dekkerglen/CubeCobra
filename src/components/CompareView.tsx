import React, { useContext } from 'react';
import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from 'components/AutocardListItem';
import withCardModal from 'components/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import Card from 'datatypes/Card';
import { getLabels, sortIntoGroups } from 'utils/Sort';

export interface CompareGroupProps {
  heading: string;
  both: Card[];
  onlyA: Card[];
  onlyB: Card[];
}

const CardModalLink = withCardModal(AutocardListItem);

const CompareGroup: React.FC<CompareGroupProps> = ({ heading, both, onlyA, onlyB }) => {
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
            {(
              [
                [bothCmc, 'both'],
                [onlyACmc, 'a'],
                [onlyBCmc, 'b'],
              ] as [Record<string, Card[]>, string][]
            ).map(([cards, key]) => (
              <Col xs="4" key={key}>
                {(cards[cmc] || []).map((card, index) => (
                  <CardModalLink
                    key={card.index}
                    card={card}
                    altClick={() => {
                      window.open(`/tool/card/${card.cardID}`);
                    }}
                    className={index === 0 ? 'cmc-group' : undefined}
                    modalprops={{
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

export interface CompareViewProps {
  cards: Card[];
  // These fields all take oracle_ids.
  both: string[];
  onlyA: string[];
  onlyB: string[];
}

const CompareView: React.FC<CompareViewProps> = ({ cards, both, onlyA, onlyB }) => {
  const { sortPrimary, sortSecondary, cube } = useContext(CubeContext) ?? {};

  const columnsPrimary = sortIntoGroups(cards, sortPrimary ?? 'Unsorted', !!cube?.showUnsorted);
  const columnsSecondary: Record<string, Record<string, Card[]>> = {};
  const columnCounts: Record<string, number> = {};
  const bothCounts: Record<string, number> = { total: 0 };
  const onlyACounts: Record<string, number> = { total: 0 };
  const onlyBCounts: Record<string, number> = { total: 0 };

  const bothCopyTemp = both.slice(0);
  const onlyACopyTemp = onlyA.slice(0);
  const onlyBCopyTemp = onlyB.slice(0);

  for (const columnLabel of Object.keys(columnsPrimary)) {
    let onlyACount = 0;
    let onlyBCount = 0;
    let bothCount = 0;
    for (const card of columnsPrimary[columnLabel]) {
      const oracleId = card.details?.oracle_id ?? '';
      let index;
      if ((index = bothCopyTemp.indexOf(oracleId)) >= 0) {
        bothCount += 1;
        bothCopyTemp.splice(index, 1);
      } else if ((index = onlyACopyTemp.indexOf(oracleId)) >= 0) {
        onlyACount += 1;
        onlyACopyTemp.splice(index, 1);
      } else if ((index = onlyBCopyTemp.indexOf(oracleId)) >= 0) {
        onlyBCount += 1;
        onlyBCopyTemp.splice(index, 1);
      }
    }

    columnCounts[columnLabel] = columnsPrimary[columnLabel].length;
    bothCounts[columnLabel] = bothCount;
    bothCounts.total += bothCount;
    onlyACounts[columnLabel] = onlyACount;
    onlyACounts.total += onlyACount;
    onlyBCounts[columnLabel] = onlyBCount;
    onlyBCounts.total += onlyBCount;
    columnsSecondary[columnLabel] = sortIntoGroups(
      columnsPrimary[columnLabel],
      sortSecondary ?? 'Unsorted',
      !!cube?.showUnsorted,
    );
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
      {getLabels(cards, sortPrimary ?? 'Unsorted', cube?.showUnsorted)
        .filter((columnLabel) => columnsPrimary[columnLabel])
        .map((columnLabel) => {
          const column = columnsSecondary[columnLabel];
          return (
            <Row key={columnLabel}>
              <Col xs={12} md="10" lg="8" className="mx-auto">
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
                {getLabels(Object.values(column).flat(), sortSecondary ?? 'Unsorted', cube?.showUnsorted)
                  .filter((label) => column[label])
                  .map((label) => {
                    const group = column[label];
                    const bothGroup: Card[] = [];
                    const onlyAGroup: Card[] = [];
                    const onlyBGroup: Card[] = [];

                    for (const card of group) {
                      const oracleId = card.details?.oracle_id ?? '';
                      let index;
                      if ((index = bothCopy.indexOf(oracleId)) >= 0) {
                        bothGroup.push(card);
                        bothCopy.splice(index, 1);
                      } else if ((index = onlyACopy.indexOf(oracleId)) >= 0) {
                        onlyAGroup.push(card);
                        onlyACopy.splice(index, 1);
                      } else if ((index = onlyBCopy.indexOf(oracleId)) >= 0) {
                        onlyBGroup.push(card);
                        onlyBCopy.splice(index, 1);
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

export default CompareView;
