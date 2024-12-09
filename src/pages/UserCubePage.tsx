import React, { useContext } from 'react';
import { Button, Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import Banner from 'components/Banner';
import CubePreview from 'components/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import Markdown from 'components/Markdown';
import MtgImage from 'components/MtgImage';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import User from 'datatypes/User';
import Cube from 'datatypes/Cube';
import Text from 'components/base/Text';

type Props = {
  owner: User;
  followers: User[];
  following: boolean;
  cubes: Cube[];
  loginCallback: string;
};

const UserCubePage: React.FC<Props> = ({ owner, followers, following, cubes, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  return (
    <MainLayout loginCallback={loginCallback}>
      <UserLayout user={owner} followers={followers} following={following} activeLink="view">
        <Banner />
        <DynamicFlash />
        <Card>
          <CardHeader>
            <Text semibold md>
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
              <Button color="accent" block outline href="/user/account">
                Update
              </Button>
            )}
          </CardBody>
        </Card>
        <Row className="my-3">
          {cubes.map((cube) => (
            <Col key={cube.id} className="mt-3" xs={6} sm={4} md={3}>
              <CubePreview cube={cube} />
            </Col>
          ))}
        </Row>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCubePage);
