import React from 'react';
import { StarIcon, StarFillIcon } from '@primer/octicons-react';
import Spinner from './Spinner';

interface VoterProps {
  votes: number;
  hasVoted: boolean;
  toggleVote: () => void;
  loading: boolean;
}

const Voter: React.FC<VoterProps> = ({ votes, hasVoted, toggleVote, loading }) => {
  return (
    <button
      onClick={toggleVote}
      className="flex items-center space-x-2 px-2 py-1 border border-border rounded-lg focus:outline-none hover:bg-bg-active transition-colors duration-300 ease-in-out"
    >
      {hasVoted ? (
        <StarFillIcon size={22} className="text-yellow-500" />
      ) : (
        <StarIcon size={22} className="text-gray-500" />
      )}
      {loading ? <Spinner md /> : <span className={`${hasVoted ? 'font-semibold' : ''}`}>{votes}</span>}
    </button>
  );
};

export default Voter;
