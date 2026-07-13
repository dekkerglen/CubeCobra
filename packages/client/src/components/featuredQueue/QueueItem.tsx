import React from 'react';

import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import { Col, Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import CubePreview from 'components/cube/CubePreview';
import MoveCubeModal from 'components/featuredQueue/MoveCubeModal';
import withModal from 'components/WithModal';

interface QueueItemProps {
  cube: Cube;
  index: number;
}

const MoveButton = withModal(Button, MoveCubeModal);

const QueueItem: React.FC<QueueItemProps> = ({ cube, index }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <Col xs={6} md={6} xl={4} xxl={3}>
      <Card className={index < 2 ? 'border-blue-600' : ''}>
        <CardBody>
          <Flexbox direction="row" justify="between" gap="2" alignItems="center">
            <Text semibold lg>
              {index + 1}
            </Text>
            <div className="flex-grow">
              <CubePreview cube={cube} />
            </div>
            <Flexbox direction="col" gap="2">
              <CSRFForm
                method="POST"
                action="/admin/featuredcubes/unqueue"
                ref={formRef}
                formData={{ cubeId: cube.id }}
              >
                <Button block color="danger" disabled={index < 2} onClick={() => formRef.current?.submit()}>
                  Remove
                </Button>
              </CSRFForm>
              <MoveButton
                block
                color="accent"
                disabled={index < 2}
                modalprops={{ cubeId: cube.id, currentPosition: index + 1 }}
              >
                Move
              </MoveButton>
            </Flexbox>
          </Flexbox>
        </CardBody>
      </Card>
    </Col>
  );
};

export default QueueItem;
