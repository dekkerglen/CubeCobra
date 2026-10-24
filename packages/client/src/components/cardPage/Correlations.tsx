import React, { useContext, useEffect, useRef, useState } from 'react';

import { cardId, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import { Combo } from '@utils/datatypes/CardCatalog';

import { CSRFContext } from '../../contexts/CSRFContext';
import useQueryParam from '../../hooks/useQueryParam';
import { Card, CardBody } from '../base/Card';
import { Flexbox } from '../base/Layout';
import { TabbedView } from '../base/Tabs';
import Text from '../base/Text';
import CardGrid from '../card/CardGrid';
import ComboCard from './CombosContent';

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
          cubeTrayDraggable
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
          cubeTrayDraggable
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
          cubeTrayDraggable
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
          cubeTrayDraggable
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
  combos?: Combo[]; // New: combos for the current card
  oracleId?: string; // New: oracle id for fetching combos when not provided
}

interface CombosTabProps {
  combos: Combo[];
  oracleId?: string;
}

// Lives in its own component so it mounts with the Combos tab rather than with the
// page. Visitors who never open the tab cost no request.
const CombosTab: React.FC<CombosTabProps> = ({ combos, oracleId }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const hasComboProp = combos.length > 0;
  const shouldFetch = !hasComboProp && !!oracleId;
  const [loadedCombos, setLoadedCombos] = useState<Combo[]>([]);
  // Starts true whenever a request is still to come, so the first paint after the
  // tab opens shows the loading state instead of flashing "No combos found".
  const [loadingCombos, setLoadingCombos] = useState<boolean>(shouldFetch);
  // The oracleId a fetch has already been started for (in flight or done). A ref rather
  // than state so re-renders while the request is loading can't fire duplicates.
  const fetchStartedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldFetch || !oracleId || fetchStartedForRef.current === oracleId) {
      return;
    }
    fetchStartedForRef.current = oracleId;

    let cancelled = false;

    const fetchCombos = async () => {
      setLoadingCombos(true);
      try {
        const res = await csrfFetch('/tool/api/getcardcombos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oracleId }),
        });
        if (cancelled) {
          return;
        }
        const data = res.ok ? await res.json() : null;
        setLoadedCombos((data?.combos ?? []) as Combo[]);
      } catch (e) {
        if (!cancelled) {
          console.error('Error fetching combos:', e);
          setLoadedCombos([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingCombos(false);
        }
      }
    };

    fetchCombos();

    return () => {
      cancelled = true;
    };
  }, [csrfFetch, shouldFetch, oracleId]);

  const combosToRender = hasComboProp ? combos : loadedCombos;

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        {!loadingCombos && combosToRender.length > 0 && <Text>{combosToRender.length} combos found.</Text>}
        {loadingCombos ? (
          <Text>Loading combos…</Text>
        ) : combosToRender.length > 0 ? (
          combosToRender.map((combo) => <ComboCard key={combo.id} combo={combo} />)
        ) : (
          <Text>No combos found.</Text>
        )}
      </Flexbox>
    </CardBody>
  );
};

const CardBreakdownInfo: React.FC<CorrelationProps> = ({
  draftedWith,
  cubedWith,
  synergistic,
  combos = [],
  oracleId,
}) => {
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
          {
            label: 'Combos',
            onClick: () => setCorrelatedTab('3'),
            content: <CombosTab combos={combos} oracleId={oracleId} />,
          },
        ]}
        activeTab={parseInt(correlatedTab || '0', 10)}
      />
    </Card>
  );
};

export default CardBreakdownInfo;
