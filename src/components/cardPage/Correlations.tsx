import React from 'react';

import { Card, CardBody } from 'components/base/Card';
import CardGrid from 'components/card/CardGrid';
import CardType from 'datatypes/CardDetails';
import { TabbedView } from 'components/base/Tabs';
import useQueryParam from 'hooks/useQueryParam';
import { cardId, detailsToCard } from 'utils/Card';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';

interface ContentProps {
  top: CardType[];
  creatures: CardType[];
  spells: CardType[];
  other: CardType[];
}

const Content: React.FC<ContentProps> = ({ top, creatures, spells, other }) => {
  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Text xl semibold>
          Top cards
        </Text>
        <CardGrid
          cards={top.map(detailsToCard)}
          xs={3}
          lg={4}
          xxl={6}
          cardProps={{ autocard: true, className: 'clickable' }}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
        <hr className="text-border" />
        <Text xl semibold>
          Creatures
        </Text>
        <CardGrid
          cards={creatures.map(detailsToCard)}
          xs={3}
          lg={4}
          xxl={6}
          cardProps={{ autocard: true, className: 'clickable' }}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
        <hr className="text-border" />
        <Text xl semibold>
          Spells
        </Text>
        <CardGrid
          cards={spells.map(detailsToCard)}
          xs={3}
          lg={4}
          xxl={6}
          cardProps={{ autocard: true, className: 'clickable' }}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
        <hr className="text-border" />
        <Text xl semibold>
          Other
        </Text>
        <CardGrid
          cards={other.map(detailsToCard)}
          xs={3}
          lg={4}
          xxl={6}
          cardProps={{ autocard: true, className: 'clickable' }}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
      </Flexbox>
    </CardBody>
  );
};

interface CorrelationProps {
  draftedWith: {
    top: CardType[];
    creatures: CardType[];
    spells: CardType[];
    other: CardType[];
  };
  cubedWith: {
    top: CardType[];
    creatures: CardType[];
    spells: CardType[];
    other: CardType[];
  };
  synergistic: {
    top: CardType[];
    creatures: CardType[];
    spells: CardType[];
    other: CardType[];
  };
}

const CardBreakdownInfo: React.FC<CorrelationProps> = ({ draftedWith, cubedWith, synergistic }) => {
  const [correlatedTab, setCorrelatedTab] = useQueryParam('correlatedTab', '0');

  return (
    <Card>
      <TabbedView
        tabs={[
          {
            label: 'Often Drafted With',
            onClick: () => setCorrelatedTab('0'),
            content: <Content {...draftedWith} />,
          },
          {
            label: 'Often Cubed With',
            onClick: () => setCorrelatedTab('1'),
            content: <Content {...cubedWith} />,
          },
          {
            label: 'Synergistic Cards',
            onClick: () => setCorrelatedTab('2'),
            content: <Content {...synergistic} />,
          },
        ]}
        activeTab={parseInt(correlatedTab || '0', 10)}
      />
    </Card>
  );
};

export default CardBreakdownInfo;
