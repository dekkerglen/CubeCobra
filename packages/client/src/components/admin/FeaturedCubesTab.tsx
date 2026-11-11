import React from 'react';

import Cube from '@utils/datatypes/Cube';

import AdminTabData from 'components/admin/AdminTabData';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import AddCubeModal from 'components/featuredQueue/AddCubeModal';
import QueueItem from 'components/featuredQueue/QueueItem';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import withModal from 'components/WithModal';

interface FeaturedCubesQueueProps {
  cubes: Cube[];
  lastRotation: number;
}

const AddCubeButton = withModal(Button, AddCubeModal);
const RotateButton = withModal(Button, ConfirmActionModal);

const FeaturedCubesQueue: React.FC<FeaturedCubesQueueProps> = ({ cubes, lastRotation }) => {
  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          Featured Cubes Queue
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" gap="2" alignItems="center">
            <AddCubeButton color="primary">Add Cube to Queue</AddCubeButton>
            <RotateButton
              color="accent"
              modalprops={{
                target: `/admin/featuredcubes/rotate`,
                title: 'Confirm Rotation',
                message: 'Are you sure you want to rotate the featured cubes?',
                buttonText: 'Submit',
              }}
            >
              Rotate featured cubes
            </RotateButton>
            <Text sm semibold>
              Last rotation: {new Date(lastRotation).toLocaleDateString()}
            </Text>
          </Flexbox>
          <Row>
            {cubes.map((cube, index) => (
              <QueueItem key={index} cube={cube} index={index} />
            ))}
          </Row>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const FeaturedCubesTab: React.FC = () => (
  <AdminTabData<FeaturedCubesQueueProps> url="/admin/featuredcubes/data">
    {({ cubes, lastRotation }) => <FeaturedCubesQueue cubes={cubes} lastRotation={lastRotation} />}
  </AdminTabData>
);

export default FeaturedCubesTab;
