import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Card from '@utils/datatypes/Card';
import classNames from 'classnames';

import { CSRFContext } from '../../contexts/CSRFContext';
import { cubeCardNameMatches } from '../../utils/cardAutocomplete';
import { normalizeProbabilities } from '../../utils/botRatings';
import Alert from '../base/Alert';
import AutocompleteInput from '../base/AutocompleteInput';
import Button from '../base/Button';
import Input from '../base/Input';
import { Col, Flexbox, Row } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Spinner from '../base/Spinner';
import Text from '../base/Text';
import CardImage from '../card/CardImage';

const DEFAULT_PACK_SIZE = 15;
const MAX_PACK_SIZE = 30;

// A slot holds a card from the cube, or just a typed name until the server resolves it.
type Slot = Card | { name: string } | null;
type BuildMode = 'score' | 'random' | 'balanced';

interface P1P1BuilderModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeId: string;
  // Start from an existing pack (e.g. a sample pack) instead of an empty one.
  initialPack?: Card[];
}

const toSlotRef = (slot: Slot) => {
  if (!slot) return null;
  if ('name' in slot && !('cardID' in slot)) return { name: slot.name };
  const card = slot as Card;
  return { cardID: card.cardID, index: card.index! };
};

const P1P1BuilderModal: React.FC<P1P1BuilderModalProps> = ({ isOpen, setOpen, cubeId, initialPack }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [slots, setSlots] = useState<Slot[]>(() =>
    initialPack && initialPack.length > 0 ? initialPack : new Array(DEFAULT_PACK_SIZE).fill(null),
  );
  const [weights, setWeights] = useState<(number | null)[] | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [cardSearch, setCardSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMatches = useMemo(() => cubeCardNameMatches(cubeId, 'mainboard'), [cubeId]);
  const filledCount = slots.filter(Boolean).length;
  const isFull = filledCount === slots.length;

  // Runs the build endpoint on the given slots. Every edit goes through here so the bot
  // ratings stay in sync with what's on screen.
  const build = useCallback(
    async (nextSlots: Slot[], mode: BuildMode, fill?: number[]) => {
      setSlots(nextSlots);
      setWeights(null);
      setError(null);
      if (mode === 'score' && !nextSlots.some(Boolean)) return;

      setLoading(true);
      try {
        const response = await csrfFetch(`/cube/api/p1p1build/${cubeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: nextSlots.map(toSlotRef), mode, fill }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to build pack');
        }
        setSlots(data.cards);
        setWeights(data.botWeights);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    },
    [csrfFetch, cubeId],
  );

  // A pack handed in from elsewhere (e.g. a sample pack) has no ratings yet.
  useEffect(() => {
    if (initialPack && initialPack.length > 0) build(initialPack, 'score');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resize = (size: number) => {
    if (!Number.isInteger(size) || size < 1 || size > MAX_PACK_SIZE) return;
    const next = slots.slice(0, size);
    while (next.length < size) next.push(null);
    setSelected((current) => Math.min(current, size - 1));
    build(next, 'score');
  };

  const setSlot = (index: number, card: Slot) =>
    build(
      slots.map((slot, i) => (i === index ? card : slot)),
      'score',
    );

  // Fills (or replaces) just this slot, leaving other empty slots alone.
  const reroll = (index: number) => build(slots, 'random', [index]);

  const placeCard = (name?: string) => {
    const picked = (name ?? cardSearch).trim();
    if (!picked) return;
    setCardSearch('');
    setSlot(selected, { name: picked });
    // Move on to the next empty slot so filling a whole pack by hand is just repeated searching.
    const nextEmpty = slots.findIndex((slot, i) => i !== selected && slot === null);
    if (nextEmpty >= 0) setSelected(nextEmpty);
  };

  const ratings = useMemo(() => {
    if (!weights) return null;
    const rated = weights.filter((w): w is number => w !== null);
    const normalized = normalizeProbabilities(rated);
    let next = 0;
    return weights.map((w) => (w === null ? null : normalized[next++]!));
  }, [weights]);
  const maxRating = ratings ? Math.max(...ratings.map((r) => r ?? 0)) : null;

  const publish = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch('/tool/api/createp1p1frompack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cubeId,
          seed: `custom-${Date.now()}`,
          cards: slots.map(toSlotRef),
          source: 'custom',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create P1P1');
      }
      window.location.href = `/cube/p1p1/${data.pack.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl scrollable>
      <ModalHeader setOpen={setOpen}>Build a P1P1</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="3">
          <Text sm className="text-text-secondary">
            Pick cards for each slot, or fill empty slots randomly. Balanced pick attempts to create evenly weighted
            picks.
          </Text>

          <Flexbox direction="row" gap="2" alignItems="end" wrap="wrap">
            <Button
              color="secondary"
              onClick={() =>
                build(
                  slots.map(() => null),
                  'score',
                )
              }
              disabled={loading}
            >
              Clear all
            </Button>
            <div className="w-24">
              <Input
                label="Pack size"
                type="number"
                value={`${slots.length}`}
                onChange={(e) => resize(parseInt(e.target.value, 10))}
                disabled={loading}
              />
            </div>
            <Button color="primary" onClick={() => build(slots, 'random')} disabled={loading || isFull}>
              Fill empty: Random
            </Button>
            <Button color="primary" onClick={() => build(slots, 'balanced')} disabled={loading || isFull}>
              Fill empty: Balanced pick
            </Button>
          </Flexbox>

          <Flexbox direction="row" gap="2" alignItems="center">
            <Text semibold className="whitespace-nowrap">
              Slot {selected + 1}:
            </Text>
            <AutocompleteInput
              getMatches={getMatches}
              value={cardSearch}
              setValue={setCardSearch}
              onSubmit={(e, match) => {
                e.preventDefault();
                placeCard(match);
              }}
              placeholder="Card from this cube"
              wrapperClassName="grow"
              portalDropdown
              disabled={loading}
            />
            <Button
              color="primary"
              className="whitespace-nowrap"
              onClick={() => placeCard()}
              disabled={loading || !cardSearch.trim()}
            >
              Set slot
            </Button>
          </Flexbox>

          {error && (
            <Alert color="danger">
              <Text>{error}</Text>
            </Alert>
          )}

          <Row xs={3} md={5} lg={5} gutters={2}>
            {slots.map((slot, index) => {
              const rating = ratings?.[index];
              return (
                <Col key={index} xs={1}>
                  <Flexbox direction="col" gap="1">
                    <div
                      className={classNames('relative rounded-lg cursor-pointer', {
                        'ring-[4px] ring-[#E6B800]': index === selected,
                        'ring-[4px] ring-[#007BFF]': index !== selected && rating != null && rating === maxRating,
                      })}
                      onClick={() => setSelected(index)}
                    >
                      {slot && 'cardID' in slot ? (
                        <CardImage card={slot as Card} autocard />
                      ) : (
                        <div className="aspect-[488/680] rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                          <Text sm className="text-text-secondary">
                            Slot {index + 1}
                          </Text>
                        </div>
                      )}
                      {rating != null && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-gray-700/80 text-white text-sm">
                          {Math.round(rating * 100)}%
                        </div>
                      )}
                    </div>
                    <Flexbox direction="row" gap="1" justify="center">
                      <Button
                        color="secondary"
                        outline
                        className="px-2 py-1 text-sm"
                        onClick={() => reroll(index)}
                        disabled={loading}
                        title="Replace with a random card from the mainboard that isn't already in the pack"
                      >
                        Random card
                      </Button>
                      {slot && (
                        <Button
                          color="secondary"
                          outline
                          className="px-2 py-1 text-sm"
                          onClick={() => setSlot(index, null)}
                          disabled={loading}
                        >
                          Clear
                        </Button>
                      )}
                    </Flexbox>
                  </Flexbox>
                </Col>
              );
            })}
          </Row>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text sm className="text-text-secondary">
            {loading ? <Spinner sm /> : `${filledCount} / ${slots.length} slots filled`}
          </Text>
          <Button color="primary" onClick={publish} disabled={loading || !isFull}>
            Publish P1P1
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default P1P1BuilderModal;
