import React, { useContext } from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import Markdown from 'components/Markdown';
import MtgImage from 'components/MtgImage';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import Cube from 'datatypes/Cube';
import User from 'datatypes/User';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';

interface UserCubePageProps {
  owner: User;
  followersCount: number;
  following: boolean;
  cubes: Cube[];
}

const UserCubePage: React.FC<UserCubePageProps> = ({
  owner,
  followersCount,
  following,
  cubes,
}) => {
  const user = useContext(UserContext);
  return (
    <MainLayout>
      <UserLayout user={owner} followersCount={followersCount} following={following} activeLink="view">
        <DynamicFlash />
        <Flexbox direction="col" className="my-3" gap="2">
          <Card>
            <CardHeader>
              <Text semibold lg>
                About
              </Text>
            </CardHeader>
            <CardBody>
              <Row className="mb-3">
                {owner.image && (
                  <Col xs={4} lg={3}>
                    <MtgImage image={owner.image} showArtist />
                  </Col>
                )}
                <Col xs={owner.image ? 8 : 12} lg={owner.image ? 9 : 12}>
                  <Markdown markdown={owner.about || '_This user has not yet filled out their about section._'} />
                </Col>
              </Row>
              {user && user.id === owner.id && (
                <Button type="link" color="accent" block href="/user/account">
                  Update
                </Button>
              )}
            </CardBody>
          </Card>
          <Row>
            {cubes.map((cube) => (
              <Col key={cube.id} className="mt-3" xs={6} sm={4} md={3} xl={2}>
                <CubePreview cube={cube} />
              </Col>
            ))}
          </Row>
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCubePage);
