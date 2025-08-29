import React from 'react';
import { PasteIcon } from '@primer/octicons-react';

import Button from '../base/Button';
import Link from '../base/Link';
import Text from '../base/Text';
import { Flexbox } from '../base/Layout';

import { P1P1VoteSummary } from '../../../datatypes/P1P1Pack';

interface P1P1HeaderProps {
  pack: { cubeId: string };
  votes: P1P1VoteSummary;
  showBotWeights: boolean;
  onToggleBotWeights: () => void;
  cubeName?: string;
  cubeOwner?: string;
}

const P1P1Header: React.FC<P1P1HeaderProps> = ({ pack, votes, showBotWeights, onToggleBotWeights, cubeName, cubeOwner }) => {
  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <Flexbox direction="row" justify="between" alignItems="center">
      <Text semibold lg>
        Pack 1 Pick 1 from{' '}
        <Link href={`/cube/overview/${pack.cubeId}`} className="text-decoration-none">
          {cubeName || 'Unknown Cube'}
        </Link>
        {cubeOwner && (
          <>
            {' '}
            by{' '}
            <Link href={`/user/view/${cubeOwner}`} className="text-decoration-none">
              {cubeOwner}
            </Link>
          </>
        )}
      </Text>

      <Flexbox direction="row" gap="2" alignItems="center">
        {votes.botWeights && votes.botWeights.length > 0 && (
          <Button color="primary" onClick={onToggleBotWeights} className="px-3 py-2">
            {showBotWeights ? 'Show Vote Percentages' : 'Show Bot Weights'}
          </Button>
        )}
        <Button color="primary" className="px-3 py-2" onClick={handleShare}>
          <PasteIcon size={16} className="me-1" />
          Share
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export default P1P1Header;
