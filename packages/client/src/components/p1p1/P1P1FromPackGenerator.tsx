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
  // Button label; defaults to the sample-pack wording.
  label?: string;
  // When true (e.g. during a live draft), open the created P1P1 in a new tab and
  // surface a shareable link instead of navigating away from the current page.
  openInNewTab?: boolean;
}

const P1P1FromPackGenerator: React.FC<P1P1FromPackGeneratorProps> = ({
  cubeId,
  seed,
  pack,
  label = 'Create P1P1 from Pack',
  openInNewTab = false,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

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
      const packUrl = `/cube/p1p1/${data.pack.id}`;

      if (openInNewTab) {
        // Keep the user in their in-progress draft; open the shareable P1P1 in a
        // new tab and leave the link on screen so they can copy it.
        setCreatedUrl(packUrl);
        window.open(packUrl, '_blank', 'noopener');
      } else {
        window.location.href = packUrl;
      }
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

  if (createdUrl) {
    return (
      <Button color="accent" href={createdUrl} target="_blank" rel="noopener noreferrer">
        View / Share P1P1
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
        {generating ? <Spinner sm /> : label}
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
