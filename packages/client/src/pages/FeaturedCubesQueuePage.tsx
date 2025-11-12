import React from 'react';

import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import AddCubeModal from 'components/featuredQueue/AddCubeModal';
import QueueItem from 'components/featuredQueue/QueueItem';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import MainLayout from 'layouts/MainLayout';

interface FeaturedCubesQueuePageProps {
  cubes: Cube[];
  daysBetweenRotations: number;
  lastRotation: number;
}

const AddCubeButton = withModal(Button, AddCubeModal);
const RotateButton = withModal(Button, ConfirmActionModal);

const FeaturedCubesQueuePage: React.FC<FeaturedCubesQueuePageProps> = ({ cubes, lastRotation }) => {
  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-2">
        <DynamicFlash />
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
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(FeaturedCubesQueuePage);
