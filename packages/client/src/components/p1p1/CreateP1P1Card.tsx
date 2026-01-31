import React, { useContext, useState } from 'react';

import { CSRFContext } from '../../contexts/CSRFContext';
import Button from '../base/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

interface CreateP1P1CardProps {
  cubeId: string;
}

const CreateP1P1Card: React.FC<CreateP1P1CardProps> = ({ cubeId }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateP1P1 = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // First generate a sample pack
      const packResponse = await fetch(`/cube/api/p1p1/${cubeId}`);

      if (!packResponse.ok) {
        throw new Error('Failed to generate pack');
      }

      const packData = await packResponse.json();

      // Get the full card data for the pack
      const cardsResponse = await csrfFetch(`/cube/api/cardsfromseed/${cubeId}/${packData.seed}`);

      if (!cardsResponse.ok) {
        throw new Error('Failed to fetch pack cards');
      }

      const cardsData = await cardsResponse.json();

      // Create P1P1 from the pack
      const createResponse = await csrfFetch('/tool/api/createp1p1frompack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cubeId: cubeId,
          seed: packData.seed,
          cards: cardsData.cards.map((card: any) => ({ cardID: card.cardID, index: card.index })),
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create P1P1');
      }

      const data = await createResponse.json();

      // Redirect to the P1P1 page
      window.location.href = `/cube/p1p1/${data.pack.id}`;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          Create P1P1
        </Text>
      </CardHeader>
      <CardBody>
        <Text>
          Generate a new Pack 1 Pick 1 poll from a random pack. Users can vote on which card they would pick first.
        </Text>
        {error && (
          <Text sm className="text-red-500 mt-2">
            {error}
          </Text>
        )}
      </CardBody>
      <CardFooter>
        <Flexbox direction="row" justify="end">
          <Button color="primary" onClick={handleCreateP1P1} disabled={isGenerating} block>
            {isGenerating ? 'Generating...' : 'Generate P1P1'}
          </Button>
        </Flexbox>
      </CardFooter>
    </Card>
  );
};

export default CreateP1P1Card;
