import React, { useState } from 'react';

import Cube from '../../datatypes/Cube';
import { P1P1VoteSummary } from '../../datatypes/P1P1Pack';
import Alert from '../components/base/Alert';
import Button from '../components/base/Button';
import { Card, CardBody } from '../components/base/Card';
import { Flexbox } from '../components/base/Layout';
import Link from '../components/base/Link';
import Spinner from '../components/base/Spinner';
import Text from '../components/base/Text';
import CommentsSection from '../components/comments/CommentsSection';
import DynamicFlash from '../components/DynamicFlash';
import P1P1Header from '../components/p1p1/P1P1Header';
import P1P1PackDisplay from '../components/p1p1/P1P1PackDisplay';
import P1P1Results from '../components/p1p1/P1P1Results';
import RenderToRoot from '../components/RenderToRoot';
import useP1P1Pack from '../hooks/useP1P1Pack';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

interface P1P1PageProps {
  packId: string;
  cube: Cube;
}

const P1P1Page: React.FC<P1P1PageProps> = ({ packId, cube }) => {
  const { pack, votes, loading, error, refetch } = useP1P1Pack(packId);
  const [currentVotes, setCurrentVotes] = useState<P1P1VoteSummary | null>(null);
  const [showBotWeights, setShowBotWeights] = useState<boolean>(false);

  // Update current votes when pack votes change
  React.useEffect(() => {
    if (votes) {
      setCurrentVotes(votes);
    }
  }, [votes]);

  const handleVoteUpdate = (newVotes: P1P1VoteSummary) => {
    // Preserve bot data when updating votes since they're not returned by the vote API
    setCurrentVotes((prevVotes) => ({
      ...newVotes,
      botPick: prevVotes?.botPick,
      botWeights: prevVotes?.botWeights,
    }));
  };

  if (loading) {
    return (
      <MainLayout>
        <CubeLayout cube={cube} activeLink="playtest">
          <Flexbox direction="col" gap="3" className="my-4">
            <div className="text-center">
              <Spinner lg />
              <Text className="mt-3">Loading P1P1 pack...</Text>
            </div>
          </Flexbox>
        </CubeLayout>
      </MainLayout>
    );
  }

  if (!loading && !pack && error) {
    return (
      <MainLayout>
        <CubeLayout cube={cube} activeLink="playtest">
          <Flexbox direction="col" gap="3" className="my-4">
            <DynamicFlash />
            <Alert color="danger">
              <Flexbox direction="col" gap="2">
                <Text semibold>Error Loading P1P1</Text>
                <Text>{error || 'P1P1 pack not found'}</Text>
                <Flexbox direction="row" gap="2">
                  <Button color="primary" onClick={refetch}>
                    Try Again
                  </Button>
                  <Link href="/cube/explore">
                    <Button color="secondary">Browse Cubes</Button>
                  </Link>
                </Flexbox>
              </Flexbox>
            </Alert>
          </Flexbox>
        </CubeLayout>
      </MainLayout>
    );
  }

  // Show loading if we have pack but currentVotes is still being set up
  if (!currentVotes || !pack) {
    return (
      <MainLayout>
        <CubeLayout cube={cube} activeLink="playtest">
          <Flexbox direction="col" gap="3" className="my-4">
            <div className="text-center">
              <Spinner lg />
              <Text className="mt-3">Loading P1P1 pack...</Text>
            </div>
          </Flexbox>
        </CubeLayout>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="playtest">
        <Flexbox direction="col" gap="3" className="my-4">
          <DynamicFlash />

          <Card>
            <CardBody className="pb-2">
              <P1P1Header
                pack={pack}
                votes={currentVotes}
                showBotWeights={showBotWeights}
                onToggleBotWeights={() => setShowBotWeights(!showBotWeights)}
              />
            </CardBody>

            <div className="border-t border-border">
              <CardBody>
                <P1P1PackDisplay
                  pack={pack}
                  votes={currentVotes}
                  showBotWeights={showBotWeights}
                  onVoteUpdate={handleVoteUpdate}
                />
              </CardBody>
            </div>

            {currentVotes?.userVote !== undefined && <P1P1Results pack={pack} votes={currentVotes} />}

            <div className="border-t border-border">
              <CommentsSection parentType="p1p1" parent={pack.id} collapse={false} />
            </div>
          </Card>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(P1P1Page);
