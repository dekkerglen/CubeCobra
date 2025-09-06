import { useEffect, useState } from 'react';

import { P1P1Pack, P1P1VoteSummary } from '../../datatypes/P1P1Pack';

interface UseP1P1PackResult {
  pack: P1P1Pack | null;
  votes: P1P1VoteSummary | null;
  cubeName?: string;
  cubeOwner?: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const useP1P1Pack = (packId: string | null): UseP1P1PackResult => {
  const [pack, setPack] = useState<P1P1Pack | null>(null);
  const [votes, setVotes] = useState<P1P1VoteSummary | null>(null);
  const [cubeName, setCubeName] = useState<string | undefined>();
  const [cubeOwner, setCubeOwner] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPack = async () => {
    if (!packId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/tool/api/getp1p1/${packId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch P1P1 pack');
      }

      const data = await response.json();
      
      setPack(data.pack);
      setVotes(data.votes);
      setCubeName(data.cube?.name);
      setCubeOwner(data.cube?.owner);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setPack(null);
      setVotes(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  return {
    pack,
    votes,
    cubeName,
    cubeOwner,
    loading,
    error,
    refetch: fetchPack,
  };
};

export default useP1P1Pack;