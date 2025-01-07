import { Col, Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import Cube from 'datatypes/Cube';
import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import CSRFForm from 'components/CSRFForm';
import CubePreview from 'components/cube/CubePreview';
import MoveModal from 'components/featuredQueue/MoveModal';
import withModal from 'components/WithModal';

const MoveButton = withModal(Button, MoveModal);

interface QueueItemProps {
  cube: Cube;
  index: number;
}

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
              <MoveButton block color="accent" disabled={index < 2} modalprops={{ cube, index }}>
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
