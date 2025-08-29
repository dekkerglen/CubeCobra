import React, { useMemo } from 'react';

import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Table from '../base/Table';
import Text from '../base/Text';
import withAutocard from '../WithAutocard';

import { detailsToCard } from '../../utils/cardutil';

import P1P1Pack from '../../../datatypes/P1P1Pack';
import { P1P1VoteSummary } from '../../../datatypes/P1P1Pack';

interface P1P1ResultsProps {
  pack: P1P1Pack;
  votes: P1P1VoteSummary;
}

// Create autocard-enabled link component
const AutocardLink = withAutocard(Link);

const P1P1Results: React.FC<P1P1ResultsProps> = ({ pack, votes }) => {
  const topResults = useMemo(() => {
    if (votes.totalVotes === 0 && votes.botPick === undefined) {
      return [];
    }

    if (votes.totalVotes === 0 && votes.botPick !== undefined) {
      return [
        {
          cardIndex: votes.botPick,
          voteCount: 0,
          percentage: 0,
        },
      ];
    }

    const totalVotesWithBot = votes.totalVotes + (votes.botPick !== undefined ? 1 : 0);
    const cardVoteMap = new Map<number, number>();

    // Accumulate human votes
    votes.results.forEach((result) => {
      cardVoteMap.set(result.cardIndex, result.voteCount);
    });

    // Add bot vote
    if (votes.botPick !== undefined) {
      const existing = cardVoteMap.get(votes.botPick) || 0;
      cardVoteMap.set(votes.botPick, existing + 1);
    }

    return Array.from(cardVoteMap.entries())
      .map(([cardIndex, voteCount]) => ({
        cardIndex,
        voteCount,
        percentage: totalVotesWithBot > 0 ? (voteCount / totalVotesWithBot) * 100 : 0,
      }))
      .filter((result) => result.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount || b.percentage - a.percentage);
  }, [votes.results, votes.totalVotes, votes.botPick]);

  // If no votes and no bot pick, show empty state
  if (topResults.length === 0) {
    return <Text className="text-center text-muted">No votes yet. Be the first to vote!</Text>;
  }

  const headers = ['Rank', 'Card', 'Votes', 'Percentage'];
  const rows = topResults.map((result, index) => {
    const card = detailsToCard(pack.cards[result.cardIndex]);
    const isUserVote = votes.userVote === result.cardIndex;
    const isBotPick = votes.botPick === result.cardIndex;

    return {
      Rank: (
        <Text semibold className={isUserVote ? 'text-primary' : ''}>
          #{index + 1}
        </Text>
      ),
      Card: (
        <span>
          <AutocardLink card={card} href={`/tool/card/${card.cardID}`} className={isUserVote ? 'text-primary' : ''}>
            {card.details?.name || card.cardID}
          </AutocardLink>
          {isUserVote && <span className="text-primary ms-1">(Your pick)</span>}
          {isBotPick && (
            <span className="ms-1" title="CubeCobra's pick">
              <img src="/content/logo.png" alt="CubeCobra" className="w-4 h-4 inline-block" />
            </span>
          )}
        </span>
      ),
      Votes: (
        <Text className={isUserVote ? 'text-primary' : ''}>
          {result.voteCount} vote{result.voteCount !== 1 ? 's' : ''}
        </Text>
      ),
      Percentage: (
        <Text semibold className={isUserVote ? 'text-primary' : ''}>
          {result.percentage.toFixed(1)}%
        </Text>
      ),
    };
  });

  return (
    <>
      <div className="border-t border-border p-4">
        <Text semibold lg className="mb-3">
          Voting Results
        </Text>
        <Flexbox direction="col" gap="3">
          <Text>
            Total votes: <strong>{votes.totalVotes + (votes.botPick !== undefined ? 1 : 0)}</strong>
            {votes.botPick !== undefined && votes.totalVotes > 0 && (
              <span className="text-muted ms-1">({votes.totalVotes} human + CubeCobra's Pick)</span>
            )}
          </Text>

          <Text semibold>{votes.totalVotes === 0 ? "CubeCobra's Pick:" : 'Top Picks:'}</Text>
        </Flexbox>
      </div>
      <Table headers={headers} rows={rows} />
    </>
  );
};

export default P1P1Results;
