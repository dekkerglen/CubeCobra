import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AlertIcon, QuestionIcon } from '@primer/octicons-react';

import Alert from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import { cardNameMatches, fetchCardImage } from 'utils/cardAutocomplete';

const TOOLTIP_SHOW_EXTRAS =
  "When enabled, search includes promos, tokens, digital versions, non-standard layouts, non-English cards, 'flavour' names, special editions, and more.";

const CreatePackagePage: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const [cards, setCards] = useState<string[]>([]);
  const [cardName, setCardName] = useState<string>('');
  const [packageName, setPackageName] = useState<string>('');
  // Scryfall id of the card currently named in the input, or null if the name
  // doesn't resolve. Gates the Add button (replaces the old in-memory imagedict).
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(true);

  const addCardMatches = useMemo(() => cardNameMatches(true, showExtras), [showExtras]);

  useEffect(() => {
    if (!cardName) {
      setResolvedId(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const image = await fetchCardImage(cardName, controller.signal);
      setResolvedId(image?.id ?? null);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cardName]);

  const submitCard = () => {
    if (resolvedId) {
      setCards([...cards, resolvedId]);
      setCardName('');
      setResolvedId(null);
    }
  };

  const save = async () => {
    setError(null);
    const response = await csrfFetch(`/packages/submit`, {
      method: 'POST',
      body: JSON.stringify({ cards, packageName }),
      headers: { 'Content-Type': 'application/json' },
    });

    const json = await response.json();
    if (json.success === 'true' && json.packageId) {
      window.location.href = `/packages/${json.packageId}`;
    } else if (json.success === 'true') {
      window.location.href = '/packages';
    } else {
      setError(json.message || 'Failed to create package.');
    }
  };

  const canSubmit = packageName.trim().length > 0 && cards.length >= 2 && cards.length <= 100;

  return (
    <MainLayout>
      <Container xxxl>
        <Flexbox direction="col" gap="3" className="py-4 px-2">
          <DynamicFlash />

          <Card>
            <CardHeader>
              <Text semibold xl>
                Create New Package
              </Text>
            </CardHeader>
            <CardBody>
              <Flexbox direction="col" gap="3">
                <Alert color="warning">
                  <Flexbox direction="row" gap="2" alignItems="start">
                    <span className="pt-0.5">
                      <AlertIcon size={16} />
                    </span>
                    <Text sm>
                      <strong>Packages are locked once created.</strong> The card list cannot be edited after submission
                      — to change contents you must delete the package and recreate it. Choose your cards and name
                      carefully before submitting.
                    </Text>
                  </Flexbox>
                </Alert>

                <Text>
                  A package is a set of cards with some unifying theme, such as "Power 9" or "Fetchlands". Once
                  approved, these packages can be quickly added to any cube.
                </Text>

                {error && <Alert color="danger">{error}</Alert>}

                <Input
                  type="text"
                  value={packageName}
                  placeholder="Untitled Package"
                  onChange={(e) => setPackageName(e.target.value)}
                  label="Package Name"
                />

                <AutocompleteInput
                  getMatches={addCardMatches}
                  type="text"
                  className="me-2"
                  name="add-card"
                  value={cardName}
                  setValue={setCardName}
                  onSubmit={(event: React.FormEvent) => {
                    event.preventDefault();
                    submitCard();
                  }}
                  placeholder="Card name and version"
                  autoComplete="off"
                  data-lpignore
                />
                <Flexbox direction="row" gap="2" alignItems="center">
                  <Checkbox label="Show Extras" checked={showExtras} setChecked={setShowExtras} />
                  <Tooltip text={TOOLTIP_SHOW_EXTRAS}>
                    <QuestionIcon size={16} />
                  </Tooltip>
                </Flexbox>
                <Button color="primary" block onClick={submitCard} disabled={!resolvedId}>
                  Add Card
                </Button>

                {cards.length > 0 && (
                  <Row xs={10}>
                    {cards.map((cardId, index) => (
                      <Col key={`${cardId}-${index}`} xs={5} sm={3} lg={2}>
                        <Card className="mb-3">
                          <img className="w-full card-border" src={`/tool/cardimage/${cardId}`} alt={cardId} />
                          <Button
                            color="danger"
                            outline
                            block
                            onClick={() => {
                              const temp = cards.slice();
                              temp.splice(index, 1);
                              setCards(temp);
                            }}
                          >
                            Remove
                          </Button>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                <Text sm className="text-text-secondary">
                  Packages require between 2 and 100 cards.
                </Text>

                <Flexbox direction="row" gap="2">
                  <LoadingButton color="primary" onClick={save} disabled={!canSubmit}>
                    <span className="px-4">Submit Package</span>
                  </LoadingButton>
                  <Button color="secondary" type="link" href="/packages">
                    <span className="px-4">Cancel</span>
                  </Button>
                </Flexbox>
              </Flexbox>
            </CardBody>
          </Card>
        </Flexbox>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(CreatePackagePage);
