import React, { useContext, useState } from 'react';

import CardType from '@utils/datatypes/Card';

import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import Spinner from '../base/Spinner';
import Text from '../base/Text';

interface P1P1FromPackGeneratorProps {
  cubeId: string;
  seed: string;
  pack: CardType[];
}

const P1P1FromPackGenerator: React.FC<P1P1FromPackGeneratorProps> = ({ cubeId, seed, pack }) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateP1P1 = async () => {
    if (!cubeId || !seed || !pack || pack.length === 0) {
      setError('Invalid pack data');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await csrfFetch('/tool/api/createp1p1frompack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cubeId: cubeId,
          seed: seed,
          cards: pack.map((card) => ({ cardID: card.cardID, index: card.index })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create P1P1 from pack');
      }

      const data = await response.json();

      // Redirect to the P1P1 page
      window.location.href = `/cube/p1p1/${data.pack.id}`;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <Button color="primary" disabled>
        Login to create a P1P1
      </Button>
    );
  }

  return (
    <>
      <Button
        color="primary"
        onClick={handleGenerateP1P1}
        disabled={generating || !cubeId || !seed || !pack || pack.length === 0}
      >
        {generating ? <Spinner sm /> : 'Create P1P1 from Pack'}
      </Button>

      {error && (
        <Alert color="danger" className="mt-2">
          <Text>{error}</Text>
        </Alert>
      )}
    </>
  );
};

export default P1P1FromPackGenerator;
