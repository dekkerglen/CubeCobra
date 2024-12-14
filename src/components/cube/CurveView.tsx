import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import CardType from 'datatypes/Card';
import React, { useContext } from 'react';
import { getLabels, sortDeep } from 'utils/Sort';
import { fromEntries } from 'utils/Util';

const cmc2Labels = getLabels(null, 'Mana Value 2');

interface TypeRowProps {
  cardType: string;
  group: CardType[];
}

const TypeRow: React.FC<TypeRowProps> = ({ cardType, group }) => {
  const sorted = fromEntries(sortDeep(group, false, 'Alphabetical', 'Mana Value 2') as [string, CardType[]][]);
  return (
    <Flexbox direction="col" gap="2" className="my-2">
      <Text semibold sm>
        {cardType} ({group.length})
      </Text>
      <Flexbox direction="row" wrap="wrap" gap="2">
        {cmc2Labels.map((cmc) => (
          <div key={cmc} style={{ width: `${100 / cmc2Labels.length}%` }}>
            <TableViewCardGroup
              heading={`${cmc} (${(sorted[cmc] || []).length})`}
              cards={sorted[cmc] || []}
              sort="Unsorted"
            />
          </div>
        ))}
      </Flexbox>
    </Flexbox>
  );
};

interface ColorCardProps {
  color: string;
  group: CardType[];
}

const ColorCard: React.FC<ColorCardProps> = ({ color, group }) => (
  <Card>
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
    <Flexbox direction="col" gap="2" className="my-3">
      {Object.entries(sorted).map(([color, group]) => (
        <ColorCard key={color} color={color} group={group} />
      ))}
    </Flexbox>
  );
};

export default CurveView;
