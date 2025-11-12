import React, { useContext, useEffect, useMemo, useState } from 'react';

import { cardId, cardName, cardOracleId } from '@utils/cardutil';
import { Combo } from '@utils/datatypes/CardCatalog';

import { Card, CardBody } from 'components/base/Card';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import CardGrid from 'components/card/CardGrid';
import Markdown from 'components/Markdown';
import { CSRFContext } from 'contexts/CSRFContext';

import { Col, Flexbox, Row } from '../components/base/Layout';
import Link from '../components/base/Link';
import Text from '../components/base/Text';
import CubeContext from '../contexts/CubeContext';

interface ComboCardProps {
  combo: Combo;
}

const zoneLocations: Record<string, string> = {
  B: 'on the battlefield',
  G: 'in the graveyard',
  E: 'exiled',
  L: 'in the library',
  H: 'in your hand',
  C: 'in your command zone',
  D: 'in the deck',
  S: 'in the stack',
};

const ComboCard: React.FC<ComboCardProps> = ({ combo }) => {
  const { cube } = useContext(CubeContext);

  const cards = useMemo(() => {
    const oracles = combo.uses.map((use: Combo['uses'][number]) => use.card.oracleId);
    //Match the first copy of the oracle id in the cube list
    const matchedOracles = new Set();
    return cube.cards.mainboard.filter((card) => {
      const oracleId = cardOracleId(card);
      if (matchedOracles.has(oracleId)) {
        return false;
      }
      const matched = oracles.includes(oracleId);
      if (matched) {
        matchedOracles.add(oracleId);
      }
      return matched;
    });
  }, [combo, cube]);

  return (
    <Card className="mb-3">
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Link href={`https://commanderspellbook.com/combo/${combo.id}`}>{cards.map(cardName).join(' + ')}</Link>
          <CardGrid cards={cards} className="gap-2" xs={4} hrefFn={(card) => `/tool/card/${cardId(card)}`} />
          <Text className="mt-2" semibold>
            Initial Card State
          </Text>
          {combo.uses.map((use: Combo['uses'][number], index) => (
            <Flexbox key={index} direction="col">
              <Text>
                <strong>{use.quantity > 1 ? `${use.quantity}x ` : ''}</strong>
                <Link href={`/tool/card/${use.card.oracleId}`}>{use.card.name}</Link>{' '}
                {use.zoneLocations.map((zone) => zoneLocations[zone]).join(', ')}
                {'.'}
              </Text>
              {use.mustBeCommander && <Text className="ml-4">+ Must be a commander</Text>}
              {use.exileCardState && <Text className="ml-4">+ Exile State: {use.exileCardState}</Text>}
              {use.libraryCardState && <Text className="ml-4">+ Library State: {use.libraryCardState}</Text>}
              {use.graveyardCardState && <Text className="ml-4">+ Graveyard State: {use.graveyardCardState}</Text>}
              {use.battlefieldCardState && (
                <Text className="ml-4">+ Battlefield State: {use.battlefieldCardState}</Text>
              )}
            </Flexbox>
          ))}
          {combo.requires.map((requirement, index) => (
            <Flexbox key={index} direction="col">
              <Text>
                <strong>{requirement.quantity > 1 ? `${requirement.quantity}x ` : ''}</strong>
                <Link href={`https://scryfall.com/search?q=${encodeURIComponent(requirement.template.scryfallQuery)}`}>
                  {requirement.template.name}
                </Link>{' '}
                {requirement.zoneLocations.map((zone) => zoneLocations[zone]).join(', ')}
                {'.'}
              </Text>
              {requirement.mustBeCommander && <Text className="ml-4">+ Must be a commander</Text>}
              {requirement.exileCardState && <Text className="ml-4">+ Exile State: {requirement.exileCardState}</Text>}
              {requirement.libraryCardState && (
                <Text className="ml-4">+ Library State: {requirement.libraryCardState}</Text>
              )}
              {requirement.graveyardCardState && (
                <Text className="ml-4">+ Graveyard State: {requirement.graveyardCardState}</Text>
              )}
              {requirement.battlefieldCardState && (
                <Text className="ml-4">+ Battlefield State: {requirement.battlefieldCardState}</Text>
              )}
            </Flexbox>
          ))}
          {combo.notablePrerequisites && combo.notablePrerequisites.length > 0 && (
            <>
              <Text className="mt-2" semibold>
                Notable Prerequisites
              </Text>
              <Markdown markdown={combo.notablePrerequisites} />
            </>
          )}
          <Text className="mt-2" semibold>
            Steps
          </Text>
          <Markdown markdown={combo.description} />
          <Text className="mt-2" semibold>
            Results
          </Text>
          {combo.produces.map((produce) =>
            produce.feature.uncountable ? (
              <Text key={produce.feature.id}>{produce.feature.name}</Text>
            ) : (
              <Text key={produce.feature.id}>
                {produce.quantity} {produce.feature.name}
              </Text>
            ),
          )}
          {combo.notes && combo.notes.length > 0 && (
            <>
              <Text className="mt-2" semibold>
                Notes
              </Text>
              <Markdown markdown={combo.notes} />
            </>
          )}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const Combos: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { cube, changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard;
  const [comboData, setComboData] = useState<Combo[]>([]);
  const { csrfFetch } = useContext(CSRFContext);
  const [resultFilter, setResultFilter] = useState<string>('');

  useEffect(() => {
    const fetchCombos = async () => {
      try {
        const response = await csrfFetch(`/cube/api/getcombos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          //Only send unique cards to get combos
          body: JSON.stringify({
            oracles: [...new Set(cards.map((card) => cardOracleId(card)))],
          }),
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();

        setComboData(data.combos);
      } finally {
        setLoading(false);
      }
    };

    fetchCombos();
  }, [cards, csrfFetch, cube.id]);

  const allResults = useMemo(() => {
    const allResults: {
      id: number;
      name: string;
    }[] = [];
    for (const combo of comboData) {
      for (const produce of combo.produces) {
        if (allResults.some((result) => result.id === produce.feature.id)) continue;
        allResults.push({
          id: produce.feature.id,
          name: produce.feature.name,
        });
      }
    }

    return allResults;
  }, [comboData]);

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Text semibold lg>
        Combos
      </Text>
      <Text>
        A list of combos in the cube. These combos are curated by{' '}
        <Link href="https://commanderspellbook.com/">Commander Spellbook</Link>, if you feel there is a missing combo
        you can submit it <Link href="https://commanderspellbook.com/login/?final=submit-a-combo">here</Link>.
      </Text>
      <Select
        label="Filter By Combo Result"
        options={[
          { value: '', label: 'All Results' },
          ...allResults.map((result) => ({
            value: String(result.id),
            label: result.name,
          })),
        ]}
        value={resultFilter}
        setValue={setResultFilter}
      />
      {loading ? (
        <Flexbox direction="row" justify="center" className="m-2">
          <Spinner xl />
          <Text className="ml-2">Loading...</Text>
        </Flexbox>
      ) : (
        <Row>
          {comboData
            .filter((combo) => {
              if (resultFilter === '') return true;
              return combo.produces.some((produce) => produce.feature.id === Number(resultFilter));
            })
            .sort((a, b) => b.popularity - a.popularity)
            .map((combo, index) => (
              <Col key={index} xs={12} lg={6}>
                <ComboCard combo={combo} />
              </Col>
            ))}
        </Row>
      )}
    </Flexbox>
  );
};

export default Combos;
