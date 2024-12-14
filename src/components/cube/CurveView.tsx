import React, { useContext } from 'react';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Row, Col } from 'components/base/Layout';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import { getLabels, sortDeep } from 'utils/Sort';
import { fromEntries } from 'utils/Util';
import CardType from 'datatypes/Card';

const cmc2Labels = getLabels(null, 'Mana Value 2');

interface TypeRowProps {
  cardType: string;
  group: CardType[];
}

const TypeRow: React.FC<TypeRowProps> = ({ cardType, group }) => {
  const sorted = fromEntries(sortDeep(group, false, 'Alphabetical', 'Mana Value 2') as [string, CardType[]][]);
  return (
    <>
      <Text semibold sm>
        {cardType} ({group.length})
      </Text>
      <Row className="row-low-padding mb-2">
        {cmc2Labels.map((cmc) => (
          <div key={cmc} className="col-low-padding" style={{ width: `${100 / cmc2Labels.length}%` }}>
            <TableViewCardGroup
              heading={`${cmc} (${(sorted[cmc] || []).length})`}
              cards={sorted[cmc] || []}
              sort="Unsorted"
            />
          </div>
        ))}
      </Row>
    </>
  );
};

interface ColorCardProps {
  color: string;
  group: CardType[];
}

const ColorCard: React.FC<ColorCardProps> = ({ color, group }) => (
  <Card className="mb-3">
    <CardHeader>
      <Text semibold md>
        {color} {group.length}
      </Text>
    </CardHeader>
    <CardBody>
      {(sortDeep(group, false, 'Alphabetical', 'Creature/Non-Creature') as [string, CardType[]][]).map(
        ([label, cncGroup]) => (
          <TypeRow key={label} cardType={label} group={cncGroup} />
        ),
      )}
    </CardBody>
  </Card>
);

interface CurveViewProps {
  cards: CardType[];
}

const CurveView: React.FC<CurveViewProps> = ({ cards }) => {
  const { sortPrimary, cube } = useContext(CubeContext);

  const sorted = fromEntries(
    sortDeep(cards, cube.showUnsorted || false, 'Alphabetical', sortPrimary || 'Color Category') as [
      string,
      CardType[],
    ][],
  );

  return (
    <Row className="my-3">
      <Col>
        {Object.entries(sorted).map(([color, group]) => (
          <ColorCard key={color} color={color} group={group} />
        ))}
      </Col>
    </Row>
  );
};

export default CurveView;
