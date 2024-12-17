import React, { useContext, useState } from 'react';

import { EyeClosedIcon, LinkExternalIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Tag from 'components/base/Tag';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import CubeIdModal from 'components/cube/CubeIdModal';
import FollowersModal from 'components/modals/FollowersModal';
import Markdown from 'components/Markdown';
import QRCodeModal from 'components/modals/QRCodeModal';
import MtgImage from 'components/MtgImage';
import TextBadge from 'components/TextBadge';
import Username from 'components/Username';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import useAlerts from 'hooks/UseAlerts';
import { getCubeDescription, getCubeId } from 'utils/Util';
import User from 'datatypes/User';
import { CSRFContext } from 'contexts/CSRFContext';

const FollowersModalLink = withModal(Link, FollowersModal);
const CubeIdModalLink = withModal(Link, CubeIdModal);
const QRCodeModalLink = withModal(Link, QRCodeModal);

const PrivateCubeIcon = () => (
  <Tooltip
    text="This cube is set as private."
    wrapperTag="span"
    className="text-secondary"
    style={{ position: 'relative', top: '-3px' }}
  >
    <EyeClosedIcon size={24} />
  </Tooltip>
);

interface CubeOverviewCardProps {
  priceOwned: number;
  pricePurchase: number;
  followers: User[];
  followed: boolean;
}

const CubeOverviewCard: React.FC<CubeOverviewCardProps> = ({ followed, priceOwned, pricePurchase, followers }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);
  const [followedState, setFollowedState] = useState(followed);
  const { addAlert } = useAlerts();

  const follow = () => {
    setFollowedState(true);

    csrfFetch(`/cube/follow/${cube.id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.error(response);
      }
    });
  };

  const unfollow = () => {
    setFollowedState(false);

    csrfFetch(`/cube/unfollow/${cube.id}`, {
      method: 'POST',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.error(response);
      }
    });
  };

  return (
    <Flexbox direction="col" gap="2">
      <Row>
        <Col xs={12} md={6} lg={5} xl={4}>
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between">
                <Text xl semibold>
                  {cube.name} {cube.visibility !== 'pu' && <PrivateCubeIcon />}
                </Text>
                <TextBadge name="Cube ID">
                  <CubeIdModalLink
                    className="text-xs"
                    modalprops={{
                      shortId: cube.shortId,
                      fullID: cube.id,
                      alert: addAlert,
                    }}
                  >
                    {getCubeId(cube)}
                  </CubeIdModalLink>
                </TextBadge>
              </Flexbox>
            </CardHeader>
            <MtgImage image={cube.image} showArtist className="w-full" />
            <CardBody>
              <Flexbox direction="col" gap="1">
                <Text semibold md>
                  {getCubeDescription(cube)}
                </Text>
                <FollowersModalLink href="#" modalprops={{ followers }}>
                  {(cube.following || []).length} {(cube.following || []).length === 1 ? 'follower' : 'followers'}
                </FollowersModalLink>
                <Text>
                  <Text italic>
                    {'Designed by '}
                    <Username user={cube.owner} />
                  </Text>{' '}
                  • <Link href={`/cube/rss/${cube.id}`}>RSS</Link> •{' '}
                  <QRCodeModalLink
                    href="#"
                    modalprops={{ link: `https://cubecobra.com/c/${cube.id}`, cubeName: cube.name }}
                  >
                    QR Code
                  </QRCodeModalLink>
                </Text>
                <Link href={`https://luckypaper.co/resources/cube-map/?cube=${cube.id}`}>
                  View in Cube Map <LinkExternalIcon size={16} />
                </Link>
                {cube.priceVisibility === 'pu' && (
                  <Flexbox direction="row" gap="2">
                    {Number.isFinite(priceOwned) && (
                      <TextBadge name="Owned">
                        <Tooltip text="TCGPlayer Market Price as owned (excluding cards marked Not Owned)">
                          ${Math.round(priceOwned).toLocaleString()}
                        </Tooltip>
                      </TextBadge>
                    )}
                    {Number.isFinite(pricePurchase) && (
                      <TextBadge name="Buy">
                        <Tooltip text="TCGPlayer Market Price for cheapest version of each card">
                          ${Math.round(pricePurchase).toLocaleString()}
                        </Tooltip>
                      </TextBadge>
                    )}
                  </Flexbox>
                )}
                {user && user.roles && user.roles.includes('Admin') && (
                  <Button
                    color="accent"
                    type="link"
                    disabled={cube.visibility !== 'pu'}
                    href={`/cube/${cube.featured ? 'unfeature/' : 'feature/'}${cube.id}`}
                  >
                    {cube.featured ? 'Remove from featured' : 'Add to featured'}
                  </Button>
                )}
                {user &&
                  cube.owner.id !== user.id &&
                  (followedState ? (
                    <Button color="danger" block onClick={unfollow}>
                      Unfollow
                    </Button>
                  ) : (
                    <Button color="primary" block onClick={follow}>
                      Follow
                    </Button>
                  ))}
              </Flexbox>
            </CardBody>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={7} xl={8}>
          <Card>
            <CardBody>
              <Markdown markdown={cube.description || ''} />
            </CardBody>
            {cube.tags && cube.tags.length > 0 && (
              <CardFooter>
                <Flexbox direction="row" gap="2" wrap="wrap">
                  {cube.tags.map((tag) => (
                    <Tag href={`/search?q=${encodeURIComponent(`tag:${tag}`)}`} key={tag} text={tag} />
                  ))}
                </Flexbox>
              </CardFooter>
            )}
          </Card>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default CubeOverviewCard;
