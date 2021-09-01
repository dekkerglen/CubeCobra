import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { csrfFetch } from 'utils/CSRF';
import MainLayout from 'layouts/MainLayout';
import DynamicFlash from 'components/DynamicFlash';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  UncontrolledAlert,
} from 'reactstrap';
import CubePropType from 'proptypes/CubePropType';
import CubePreview from 'components/CubePreview';
import RenderToRoot from 'utils/RenderToRoot';
import { GearIcon } from '@primer/octicons-react';
import withModal from 'components/WithModal';
import CSRFForm from 'components/CSRFForm';

const SetRotationModal = ({ isOpen, toggle, period, onSubmit }) => {
  const [input, setInput] = useState(period);
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>Set Rotation Period</ModalHeader>
      <ModalBody>
        <InputGroup>
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Days between rotations</InputGroupText>
          </InputGroupAddon>
          <Input type="number" value={input} onChange={(e) => setInput(e.target.value)} />
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <Button
          color="success"
          onClick={() => {
            onSubmit(input);
            toggle();
          }}
        >
          Submit
        </Button>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

SetRotationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  period: PropTypes.number.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const AddCubeModal = ({ isOpen, toggle }) => (
  <Modal isOpen={isOpen} toggle={toggle} size="xs">
    <CSRFForm method="POST" action="/admin/featuredcubes/queue">
      <ModalHeader>Add Cube to Queue</ModalHeader>
      <ModalBody>
        <InputGroup>
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Cube ID</InputGroupText>
          </InputGroupAddon>
          <Input type="text" name="cubeId" />
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success">
          Submit
        </Button>
        <Button type="button" color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </CSRFForm>
  </Modal>
);

AddCubeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const RotateModal = ({ isOpen, toggle }) => (
  <Modal isOpen={isOpen} toggle={toggle} size="xs">
    <ModalHeader>Rotate Featured Cubes</ModalHeader>
    <ModalBody>
      <p>You are about to rotate the featured cubes. Are you sure?</p>
      <CSRFForm method="POST" action="/admin/featuredcubes/rotate">
        <Button type="submit" outline block color="danger">
          Yes, I'm sure
        </Button>
      </CSRFForm>
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggle}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

RotateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const SetRotationButton = withModal(Button, SetRotationModal);
const AddCubeButton = withModal(Button, AddCubeModal);
const RotateButton = withModal(Button, RotateModal);

const QueueItem = ({ cube, index }) => (
  <Col xs={12} md={6} className="mb-3">
    <Card className={index < 2 ? 'border-primary' : ''}>
      <CardBody>
        <Row>
          <Col xs={2} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h5>{index + 1}</h5>
          </Col>
          <Col xs={6}>
            <CubePreview cube={cube} />
          </Col>
          <Col style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CSRFForm method="POST" action="/admin/featuredcubes/unqueue">
              <input type="hidden" name="cubeId" value={cube._id} />
              <Button type="submit" color="danger" outline>
                Remove
              </Button>
            </CSRFForm>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </Col>
);

QueueItem.propTypes = {
  cube: CubePropType.isRequired,
  index: PropTypes.number.isRequired,
};

const FeaturedCubesQueuePage = ({ cubes, daysBetweenRotations, lastRotation, loginCallback }) => {
  const [alerts, setAlerts] = useState([]);
  const [rotationPeriod, setRotationPeriod] = useState(daysBetweenRotations);

  const addAlert = (color, message) => {
    setAlerts([...alerts, { color, message }]);
  };

  const updateRotationPeriod = async (n) => {
    const response = await csrfFetch(`/admin/featuredcubes/setperiod/${encodeURIComponent(n)}`, { method: 'POST' });
    if (!response.ok) {
      addAlert('danger', `Rotation period update failed (status ${response.status})`);
      return;
    }
    let json;
    try {
      json = await response.json();
    } catch {
      addAlert('danger', `Malformed response received from server.`);
      return;
    }
    if (json.success === 'false') {
      addAlert('danger', json.message);
      return;
    }
    setRotationPeriod(json.period);
  };

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      {alerts.map(({ color, message }) => (
        <UncontrolledAlert color={color}>{message}</UncontrolledAlert>
      ))}
      <Card>
        <CardHeader>
          <h4>Featured Cubes Queue</h4>
        </CardHeader>
        <CardBody>
          <Row>
            <Col xs={12} md={6}>
              <h6>
                Rotation period: <span className="text-muted">{rotationPeriod} days</span>
                <SetRotationButton
                  className="p-1 ml-2"
                  modalProps={{ period: rotationPeriod, onSubmit: updateRotationPeriod }}
                >
                  <span style={{ position: 'relative', top: '-1px' }}>
                    <GearIcon size={17} />
                  </span>
                </SetRotationButton>
              </h6>
              <h6>Last rotation: {lastRotation.toLocaleDateString()}</h6>
            </Col>
            <Col className="mb-4">
              <AddCubeButton outline color="success" className="mr-md-4 mb-xs-2 mb-md-0">
                Add Cube to Queue
              </AddCubeButton>
              <RotateButton outline color="secondary">
                Rotate Featured Cubes
              </RotateButton>
            </Col>
          </Row>
          <Row>
            {cubes.map((cube, index) => (
              <QueueItem cube={cube} index={index} />
            ))}
          </Row>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

FeaturedCubesQueuePage.propTypes = {
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  daysBetweenRotations: PropTypes.number.isRequired,
  lastRotation: PropTypes.instanceOf(Date).isRequired,
  loginCallback: PropTypes.string.isRequired,
};

export default RenderToRoot(FeaturedCubesQueuePage);
