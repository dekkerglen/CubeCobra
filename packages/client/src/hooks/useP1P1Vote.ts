import { useContext, useState } from 'react';

import { P1P1VoteSummary } from '@utils/datatypes/P1P1Pack';

import { CSRFContext } from '../contexts/CSRFContext';

interface UseP1P1VoteResult {
  voting: boolean;
  error: string | null;
  submitVote: (packId: string, cardIndex: number) => Promise<P1P1VoteSummary | null>;
}

const useP1P1Vote = (): UseP1P1VoteResult => {
  const { csrfFetch } = useContext(CSRFContext);
  const [voting, setVoting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submitVote = async (packId: string, cardIndex: number): Promise<P1P1VoteSummary | null> => {
    setVoting(true);
    setError(null);

    try {
      const response = await csrfFetch('/tool/api/votep1p1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packId, cardIndex }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit vote');
      }

      const data = await response.json();
      return data.votes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setVoting(false);
    }
  };

  return {
    voting,
    error,
    submitVote,
  };
};

export default useP1P1Vote;
