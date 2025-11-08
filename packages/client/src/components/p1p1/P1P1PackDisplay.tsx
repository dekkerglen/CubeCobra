import React, { useContext, useMemo } from 'react';

import { P1P1Pack, P1P1VoteSummary } from '@utils/datatypes/P1P1Pack';
import UserContext from '../../contexts/UserContext';
import useP1P1Vote from '../../hooks/useP1P1Vote';
import { detailsToCard } from '../../../../utils/src/cardutil';
import Alert from '../base/Alert';
import { Flexbox } from '../base/Layout';
import Spinner from '../base/Spinner';
import Text from '../base/Text';
import CardGrid from '../card/CardGrid';

interface P1P1PackDisplayProps {
  pack: P1P1Pack;
  votes: P1P1VoteSummary;
  showBotWeights: boolean;
  onVoteUpdate: (votes: P1P1VoteSummary) => void;
}

const P1P1PackDisplay: React.FC<P1P1PackDisplayProps> = ({ pack, votes, showBotWeights, onVoteUpdate }) => {
  const user = useContext(UserContext);
  const { voting, error, submitVote } = useP1P1Vote();

  const handleCardClick = async (cardIndex: number) => {
    if (!user) {
      return;
    }

    if (voting) return;

    try {
      const updatedVotes = await submitVote(pack.id, cardIndex);
      if (updatedVotes) {
        onVoteUpdate(updatedVotes);
      }
    } catch {
      // Error handling is delegated to the hook
    }
  };

  const cards = pack.cards.map((card) => {
    // If card has details, convert details to card format, otherwise use the card directly
    if (card.details) {
      const baseCard = detailsToCard(card.details);
      // Preserve custom image URLs from the original card
      return {
        ...baseCard,
        imgUrl: card.imgUrl || baseCard.imgUrl,
        imgBackUrl: card.imgBackUrl || baseCard.imgBackUrl,
      };
    }
    return card;
  });

  const ratings = useMemo((): number[] | undefined => {
    if (showBotWeights && votes.botWeights && votes.botWeights.length > 0) {
      // Show bot weights
      return votes.botWeights;
    } else if (votes.userVote !== undefined) {
      // Show vote percentages after user has voted
      const totalVotesWithBot = votes.totalVotes + (votes.botPick !== undefined ? 1 : 0);
      return pack.cards.map((_, index) => {
        // Check if this card got human votes
        const voteResult = votes.results.find((r) => r.cardIndex === index);
        const humanVotes = voteResult ? voteResult.voteCount : 0;

        // Add bot vote if this is the bot's pick
        const botVotes = votes.botPick === index ? 1 : 0;
        const totalVotesForCard = humanVotes + botVotes;

        // Calculate percentage including bot vote in denominator
        return totalVotesWithBot > 0 ? totalVotesForCard / totalVotesWithBot : 0;
      });
    } else {
      // Don't show any overlays before voting
      return undefined;
    }
  }, [showBotWeights, votes.botWeights, votes.userVote, votes.totalVotes, votes.botPick, votes.results, pack.cards]);

  return (
    <Flexbox direction="col" gap="2">
      {!user && (
        <Alert color="info">
          <Text>Log in to vote on your pick!</Text>
        </Alert>
      )}

      {error && (
        <Alert color="danger">
          <Text>{error}</Text>
        </Alert>
      )}

      {voting && (
        <div className="text-center">
          <Spinner sm />
        </div>
      )}

      {showBotWeights ? (
        <Text>CubeCobra bot ratings for Pick 1 Pack 1.</Text>
      ) : user ? (
        <Flexbox direction="row" className="justify-between items-center flex-wrap gap-2">
          <Text>
            Click on a card to vote.
            {votes.userVote !== undefined && ' You can change your vote by clicking a different card.'}
          </Text>

          {/* Color Legend - Same row as instructions */}
          {votes.userVote !== undefined && (
            <div className="flex flex-row gap-4 text-sm text-muted-foreground flex-shrink-0">
              <div className="flex flex-row gap-1 items-center">
                <div className="w-2 h-2 bg-[#007BFF] rounded-full"></div>
                <span className="text-sm">Top pick</span>
              </div>
              <div className="flex flex-row gap-1 items-center">
                <div className="w-2 h-2 bg-[#E6B800] rounded-full"></div>
                <span className="text-sm">Your pick</span>
              </div>
              <div className="flex flex-row gap-1 items-center">
                <div className="w-2 h-2 bg-[#087715] rounded-full"></div>
                <span className="text-sm">Your pick + top pick</span>
              </div>
            </div>
          )}
        </Flexbox>
      ) : null}

      {/* When showing bot weights, don't highlight user selection - only show top bot pick in blue */}
      <CardGrid
        cards={cards}
        xs={3}
        md={5}
        lg={8}
        onClick={user ? (_, index) => handleCardClick(index) : undefined}
        hrefFn={user ? undefined : (card) => `/tool/card/${card.cardID}`}
        ratings={ratings}
        selectedIndex={showBotWeights ? undefined : votes.userVote}
      />
    </Flexbox>
  );
};

export default P1P1PackDisplay;
