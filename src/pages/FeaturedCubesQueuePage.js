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
  FormGroup,
  Input,
  InputGroup,
  InputGroupText,
  Label,
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
          <InputGroupText>Days between rotations</InputGroupText>
          <Input type="number" value={input} onChange={(e) => setInput(e.target.value)} />
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <Button
          color="accent"
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
          <InputGroupText>Cube ID</InputGroupText>
          <Input type="text" name="cubeId" placeholder="short or long ID of the cube." />
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="accent">
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
    <ModalHeader>Rotate featured cubes</ModalHeader>
    <ModalBody>
      <p>You are about to rotate the featured cubes. Are you sure?</p>
      <CSRFForm method="POST" action="/admin/featuredcubes/rotate">
        <Button type="submit" outline block color="unsafe">
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

const MoveModal = ({ isOpen, toggle, cube, index }) => (
  <Modal isOpen={isOpen} toggle={toggle} size="xs">
    <ModalHeader toggle={toggle}>Move Cube</ModalHeader>
    <ModalBody>
      <FormGroup>
        <Label for="move-cube-name">Cube name</Label>
        <Input id="move-cube-name" value={cube?.name} readOnly />
      </FormGroup>
      <CSRFForm method="POST" action="/admin/featuredcubes/move" id="move-cube-form">
        <Input id="move-cube-from" type="hidden" name="from" value={index + 1} />
        <Input type="hidden" name="cubeId" value={cube?.id} />
        <FormGroup>
          <Label for="move-cube-to">New position in queue</Label>
          <Input id="move-cube-to" type="number" name="to" placeholder={index + 1} />
        </FormGroup>
      </CSRFForm>
    </ModalBody>
    <ModalFooter>
      <Button color="accent" form="move-cube-form" type="submit">
        Submit
      </Button>
      <Button color="secondary" onClick={toggle}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

MoveModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cube: CubePropType,
  index: PropTypes.number,
};
MoveModal.defaultProps = {
  cube: null,
  index: 0,
};

const SetRotationButton = withModal(Button, SetRotationModal);
const AddCubeButton = withModal(Button, AddCubeModal);
const RotateButton = withModal(Button, RotateModal);

const QueueItem = ({ cube, index, onMove }) => (
  <Col xs={12} md={6} className="mb-3">
    <Card className={index < 2 ? 'border-primary' : ''}>
      <CardBody>
        <Row className="align-items-center">
          <Col xs={2} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h5>{index + 1}</h5>
          </Col>
          <Col xs={9} md={6}>
            <CubePreview cube={cube} />
          </Col>
          <Col>
            <Row className="justify-content-end pt-3">
              <Col xs={4} md={12}>
                <CSRFForm method="POST" action="/admin/featuredcubes/unqueue">
                  <input type="hidden" name="cubeId" value={cube.id} />
                  <Button type="submit" color="unsafe" outline disabled={index < 2}>
                    Remove
                  </Button>
                </CSRFForm>
              </Col>
              <Col xs={4} md={12}>
                <Button className="mt-md-2" onClick={() => onMove(cube, index)} disabled={index < 2}>
                  Move
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </Col>
);

QueueItem.propTypes = {
  cube: CubePropType.isRequired,
  index: PropTypes.number.isRequired,
  onMove: PropTypes.func.isRequired,
};

const FeaturedCubesQueuePage = ({ cubes, daysBetweenRotations, lastRotation, loginCallback }) => {
  const [alerts, setAlerts] = useState([]);
  const [rotationPeriod, setRotationPeriod] = useState(daysBetweenRotations);
  const [isMoveModalOpen, setMoveModalOpen] = useState(false);
  const [moveModalCube, setMoveModalCube] = useState(null);
  const [moveModalIndex, setMoveModalIndex] = useState(0);
  const toggleMoveModal = () => setMoveModalOpen((o) => !o);

  const handleMoveOpen = (cube, index) => {
    setMoveModalCube(cube);
    setMoveModalIndex(index);
    setMoveModalOpen(true);
  };

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
          <h4>featured cubes Queue</h4>
        </CardHeader>
        <CardBody>
          <Row>
            <Col xs={12} md={6}>
              <h6>
                Rotation period: <span className="text-muted">{rotationPeriod} days</span>
                <SetRotationButton
                  className="p-1 ms-2"
                  modalProps={{ period: rotationPeriod, onSubmit: updateRotationPeriod }}
                >
                  <span style={{ position: 'relative', top: '-1px' }}>
                    <GearIcon size={17} />
                  </span>
                </SetRotationButton>
              </h6>
              <h6>Last rotation: {new Date(lastRotation).toLocaleDateString()}</h6>
            </Col>
            <Col className="mb-4">
              <AddCubeButton outline color="accent" className="me-md-4 mb-xs-2 mb-md-0">
                Add Cube to Queue
              </AddCubeButton>
              <RotateButton outline color="secondary">
                Rotate featured cubes
              </RotateButton>
            </Col>
          </Row>
          <Row>
            {cubes.map((cube, index) => (
              <QueueItem cube={cube} index={index} onMove={handleMoveOpen} />
            ))}
          </Row>
        </CardBody>
      </Card>
      <MoveModal isOpen={isMoveModalOpen} toggle={toggleMoveModal} cube={moveModalCube} index={moveModalIndex} />
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
