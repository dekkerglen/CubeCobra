import React from 'react';

import { cardId, detailsToCard } from 'utils/cardutil';

import { CardDetails } from '../../../datatypes/Card';
import useQueryParam from '../../hooks/useQueryParam';
import { Card, CardBody } from '../base/Card';
import { Flexbox } from '../base/Layout';
import { TabbedView } from '../base/Tabs';
import Text from '../base/Text';
import CardGrid from '../card/CardGrid';

interface ContentProps {
  top: CardDetails[];
  creatures: CardDetails[];
  spells: CardDetails[];
  other: CardDetails[];
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
          md={4}
          lg={6}
          xxl={10}
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
          md={4}
          lg={6}
          xxl={10}
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
          md={4}
          lg={6}
          xxl={10}
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
          md={4}
          lg={6}
          xxl={10}
          cardProps={{ autocard: true, className: 'clickable' }}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
      </Flexbox>
    </CardBody>
  );
};

interface CorrelationProps {
  draftedWith: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
  };
  cubedWith: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
  };
  synergistic: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
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
