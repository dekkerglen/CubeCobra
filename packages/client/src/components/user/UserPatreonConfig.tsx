import React, { useContext } from 'react';

import Patron, { PatronLevels } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import { canBeFeatured } from '@utils/featuredQueueUtil';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import { Col, Flexbox, Row } from '../base/Layout';
import Text from '../base/Text';
import CubePreview from '../cube/CubePreview';
import AddFeaturedModal from '../modals/AddFeaturedModal';
import RemoveFeaturedCubeModal from '../modals/RemoveFeaturedCubeModal';
import withModal from '../WithModal';

const AddFeaturedButton = withModal(Button, AddFeaturedModal);
const RemoveFeaturedButton = withModal(Button, RemoveFeaturedCubeModal);

interface UserPatreonConfigProps {
  patron: Patron;
  featured?: {
    cube: any;
    position: number;
  };
}

const UserPatreonConfig: React.FC<UserPatreonConfigProps> = ({ patron, featured }) => {
  const user = useContext(UserContext);

  return (
    <Flexbox direction="col" gap="2">
      {user?.roles?.includes(UserRoles.PATRON) ? (
        <p>
          Your account is linked at the <b>{PatronLevels[patron.level]}</b> level.
        </p>
      ) : (
        <p>Your account is linked, but you are not an active patron.</p>
      )}
      <div className="my-3">
        <Text md semibold>
          Featured Cube
        </Text>
        {featured ? (
          <Row>
            <Col xs={12} lg={5} className="p-0">
              <CubePreview cube={featured.cube} />
            </Col>
            <Col xs={12} lg={7} className="mt-4 mt-lg-0">
              <Text semibold sm>
                Current position in queue: <span className="text-muted">{featured.position}</span>
              </Text>
              <AddFeaturedButton
                className="mt-3"
                block
                outline
                color="accent"
                modalprops={{ cubes: user?.cubes || [] }}
              >
                Replace in queue
              </AddFeaturedButton>
              <RemoveFeaturedButton className="mt-2" block outline color="danger">
                Remove from queue
              </RemoveFeaturedButton>
            </Col>
          </Row>
        ) : canBeFeatured(patron) ? (
          <>
            <p>Share your cube with others by adding it to a rotating queue of featured cubes!</p>
            <AddFeaturedButton block outline color="accent" modalprops={{ cubes: user?.cubes || [] }}>
              Add cube to queue
            </AddFeaturedButton>
          </>
        ) : (
          <p>
            Patrons subscribed at the <b>Coiling Oracle</b> level and above get to feature their cube as a reward for
            their generous support. If you'd like to have your cube featured as well,{' '}
            <a href="https://patreon.com/cubecobra" target="_blank" rel="noopener noreferrer">
              upgrade your membership level.
            </a>
          </p>
        )}
      </div>
      <Button type="link" block outline color="danger" href="/patreon/unlink">
        Unlink Patreon Account
      </Button>
    </Flexbox>
  );
};

export default UserPatreonConfig;
