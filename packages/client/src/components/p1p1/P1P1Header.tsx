import React, { useContext } from 'react';

import { PasteIcon } from '@primer/octicons-react';
import { P1P1VoteSummary } from '@utils/datatypes/P1P1Pack';

import CubeContext from '../../contexts/CubeContext';
import useAlerts, { Alerts } from '../../hooks/UseAlerts';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';

interface P1P1HeaderProps {
  pack: { cubeId: string; id: string };
  votes: P1P1VoteSummary;
  showBotWeights: boolean;
  onToggleBotWeights: () => void;
}

const P1P1Header: React.FC<P1P1HeaderProps> = ({ pack, votes, showBotWeights, onToggleBotWeights }) => {
  const { cube } = useContext(CubeContext);
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addAlert('success', 'P1P1 link copied to clipboard');
    // Auto dismiss after 3 seconds
    setTimeout(dismissAlerts, 3000);
  };

  return (
    <Flexbox direction="col" gap="2">
      <Alerts alerts={alerts} />
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold lg>
          Pack 1 Pick 1 from{' '}
          <Link href={`/cube/primer/${pack.cubeId}`} className="text-decoration-none">
            {cube.name || 'Unknown Cube'}
          </Link>
          {cube.owner?.username && (
            <>
              {' '}
              by{' '}
              <Link href={`/user/view/${cube.owner.username}`} className="text-decoration-none">
                {cube.owner.username}
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
          <Button type="link" color="accent" href={`/cube/p1p1packimage/${pack.id}`} className="px-3 py-2">
            Get image
          </Button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};

export default P1P1Header;
