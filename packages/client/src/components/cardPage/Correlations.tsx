import React, { useContext, useEffect, useMemo, useState } from 'react';

import { cardId, detailsToCard } from '@utils/cardutil';

import { CardDetails } from '@utils/datatypes/Card';
import { Combo } from '@utils/datatypes/cardCatalog';
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
  combos?: Combo[]; // New: combos for the current card
  oracleId?: string; // New: oracle id for fetching combos when not provided
}

const CardBreakdownInfo: React.FC<CorrelationProps> = ({
  draftedWith,
  cubedWith,
  synergistic,
  combos = [],
  oracleId,
}) => {
  const [correlatedTab, setCorrelatedTab] = useQueryParam('correlatedTab', '0');
  const { csrfFetch } = useContext(CSRFContext);
  const [loadedCombos, setLoadedCombos] = useState<Combo[] | null>(combos.length ? combos : null);
  const [loadingCombos, setLoadingCombos] = useState<boolean>(false);
  const [loadedForOracleId, setLoadedForOracleId] = useState<string | null>(null);

  useEffect(() => {
    if (combos.length) {
      setLoadedCombos((prev) => {
        // Only update if the data has actually changed
        if (JSON.stringify(prev) !== JSON.stringify(combos)) {
          return combos;
        }
        return prev;
      });
      setLoadedForOracleId(oracleId ?? null);
      return;
    }

    // Don't fetch if we already have loaded combos for this specific oracle ID
    if (loadedForOracleId === oracleId && loadedCombos !== null) {
      return;
    }

    // Don't fetch if already loading for this oracle ID
    if (loadingCombos && loadedForOracleId === oracleId) {
      return;
    }

    let cancelled = false;

    const fetchCombos = async () => {
      setLoadingCombos(true);

      try {
        const res = await csrfFetch('/tool/api/getcardcombos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oracleId: oracleId }),
        });

        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setLoadedCombos([]);
          setLoadedForOracleId(oracleId ?? null);
          setLoadingCombos(false);
          return;
        }

        const data = await res.json();
        const list = data?.combos ?? [];

        setLoadedCombos(list as Combo[]);
        setLoadedForOracleId(oracleId ?? null); // Only set after successful completion
        setLoadingCombos(false);
      } catch (e) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('Error fetching combos:', e);
          setLoadedCombos([]);
          setLoadedForOracleId(oracleId ?? null);
          setLoadingCombos(false);
        }
      }
    };

    fetchCombos();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combos, oracleId, correlatedTab]);

  const combosToRender = useMemo(() => loadedCombos ?? combos, [loadedCombos, combos]);

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
            content: (
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
            ),
          },
        ]}
        activeTab={parseInt(correlatedTab || '0', 10)}
      />
    </Card>
  );
};

export default CardBreakdownInfo;
