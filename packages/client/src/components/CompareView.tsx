import React, { useContext } from 'react';

import { CardDetails } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { getLabels, sortIntoGroups } from '@utils/sorting/Sort';

import CubeContext from '../contexts/CubeContext';
import { Card, CardBody } from './base/Card';
import { Col, Flexbox, Row } from './base/Layout';
import { ListGroup, ListGroupItem } from './base/ListGroup';
import Text from './base/Text';
import AutocardListItem from './card/AutocardListItem';
import AddToCubeModal from './modals/AddToCubeModal';
import withModal from './WithModal';

const AutocardListItemLink = withModal(AutocardListItem, AddToCubeModal);
export interface CompareGroupProps {
  heading: string;
  both: CardType[];
  onlyA: CardType[];
  onlyB: CardType[];
}

const CompareGroup: React.FC<CompareGroupProps> = ({ heading, both, onlyA, onlyB }) => {
  const bothCmc = sortIntoGroups(both, 'Mana Value');
  const onlyACmc = sortIntoGroups(onlyA, 'Mana Value');
  const onlyBCmc = sortIntoGroups(onlyB, 'Mana Value');

  return (
    <ListGroup>
      <ListGroupItem heading>
        <div className="w-full">
          <Flexbox direction="row" gap="2" justify="center">
            <Text sm semibold>
              {heading}
            </Text>
          </Flexbox>
          <Row className="w-full">
            <Col xs={4}>
              <Flexbox direction="row" gap="2" justify="center">
                <Text sm semibold>
                  ({both.length})
                </Text>
              </Flexbox>
            </Col>
            <Col xs={4}>
              <Flexbox direction="row" gap="2" justify="center">
                <Text sm semibold>
                  ({onlyA.length})
                </Text>
              </Flexbox>
            </Col>
            <Col xs={4}>
              <Flexbox direction="row" gap="2" justify="center">
                <Text sm semibold>
                  ({onlyB.length})
                </Text>
              </Flexbox>
            </Col>
          </Row>
        </div>
      </ListGroupItem>
      {getLabels(null, 'Mana Value')
        .filter((cmc) => onlyACmc[cmc] || bothCmc[cmc] || onlyBCmc[cmc])
        .map((cmc) => (
          <Row key={cmc} gutters={0}>
            {(
              [
                [bothCmc, 'both'],
                [onlyACmc, 'a'],
                [onlyBCmc, 'b'],
              ] as [Record<string, CardType[]>, string][]
            ).map(([cards, key]) => (
              <Col xs={4} key={key}>
                {(cards[cmc] || []).map((card, index) => (
                  <AutocardListItemLink
                    key={card.index}
                    card={card}
                    className={index === 0 ? 'border-t border-border-secondary' : undefined}
                    modalprops={{ card: CardDetails(card) }}
                  />
                ))}
              </Col>
            ))}
          </Row>
        ))}
    </ListGroup>
  );
};

interface SummaryCardProps {
  label: string;
  both: number;
  onlyA: number;
  onlyB: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, both, onlyA, onlyB }) => (
  <>
    <Flexbox direction="row" gap="2" justify="center">
      <Text semibold lg>
        {label}
      </Text>
    </Flexbox>
    <Row>
      <Col xs={4}>
        <Flexbox direction="col" alignItems="center">
          <Text semibold md>
            In Both cubes
          </Text>
          <Text semibold md>
            ({both})
          </Text>
        </Flexbox>
      </Col>
      <Col xs={4}>
        <Flexbox direction="col" alignItems="center">
          <Text semibold md>
            Only in Base Cube
          </Text>
          <Text semibold md>
            ({onlyA})
          </Text>
        </Flexbox>
      </Col>
      <Col xs={4}>
        <Flexbox direction="col" alignItems="center">
          <Text semibold md>
            Only in Comparison Cube
          </Text>
          <Text semibold md>
            ({onlyB})
          </Text>
        </Flexbox>
      </Col>
    </Row>
  </>
);

export interface CompareViewProps {
  cards: CardType[];
  // These fields all take oracle_ids.
  both: string[];
  onlyA: string[];
  onlyB: string[];
}

const CompareView: React.FC<CompareViewProps> = ({ cards, both, onlyA, onlyB }) => {
  const { sortPrimary, sortSecondary, cube } = useContext(CubeContext) ?? {};

  const columnsPrimary = sortIntoGroups(cards, sortPrimary ?? 'Unsorted', !!cube?.showUnsorted);
  const columnsSecondary: Record<string, Record<string, CardType[]>> = {};
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
    <Flexbox direction="col" gap="3" className="my-2">
      <Card>
        <CardBody>
          <SummaryCard label="All Cards" both={both.length} onlyA={onlyA.length} onlyB={onlyB.length} />
        </CardBody>
      </Card>
      {getLabels(cards, sortPrimary ?? 'Unsorted', cube?.showUnsorted)
        .filter((columnLabel) => columnsPrimary[columnLabel])
        .map((columnLabel) => {
          const column = columnsSecondary[columnLabel];
          return (
            <Flexbox key={columnLabel} direction="col" gap="1">
              <Card>
                <CardBody>
                  <SummaryCard
                    label={columnLabel}
                    both={bothCounts[columnLabel]}
                    onlyA={onlyACounts[columnLabel]}
                    onlyB={onlyBCounts[columnLabel]}
                  />
                </CardBody>
              </Card>
              {getLabels(Object.values(column).flat(), sortSecondary ?? 'Unsorted', cube?.showUnsorted)
                .filter((label) => column[label])
                .map((label) => {
                  const group = column[label];
                  const bothGroup: CardType[] = [];
                  const onlyAGroup: CardType[] = [];
                  const onlyBGroup: CardType[] = [];

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
                    <CompareGroup key={label} heading={label} both={bothGroup} onlyA={onlyAGroup} onlyB={onlyBGroup} />
                  );
                })}
            </Flexbox>
          );
        })}
    </Flexbox>
  );
};

export default CompareView;
