import React, { useMemo } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Collapse,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Label,
  UncontrolledDropdown,
} from 'reactstrap';
import PropTypes from 'prop-types';

import useToggle from 'hooks/UseToggle';

const DEFAULT_STEP = Object.freeze([
  { action: 'pick', amount: 1 },
  { action: 'pass', amount: null },
]);

const ACTION_LABELS = Object.freeze({
  pick: 'Pick',
  pass: 'Pass',
  trash: 'Trash',
  pickrandom: 'Randomly Pick',
  trashrandom: 'Randomly Trash',
});

const CustomPackCard = ({ packIndex, pack, canRemove, mutations }) => {
  const [slotsOpen, toggleSlotsOpen] = useToggle(true);
  const [stepsOpen, toggleStepsOpen] = useToggle(false);
  const steps = useMemo(
    () =>
      pack.steps ??
      new Array(pack.slots.length)
        .fill(DEFAULT_STEP)
        .flat()
        .slice(0, pack.slots.length * 2 - 1),
    [pack],
  );
  return (
    <Card key={packIndex} className="mb-3">
      <CardHeader>
        <CardTitle className="mb-0">
          Pack {packIndex + 1} - {pack.slots.length} Cards
          {canRemove && <Button close onClick={mutations.removePack} data-pack-index={packIndex} />}
        </CardTitle>
      </CardHeader>
      <CardBody className="p-1">
        <Card key="slots" className="mb-2 mx-1">
          <CardHeader onClick={toggleSlotsOpen}>
            <CardTitle className="mb-0">Slots</CardTitle>
          </CardHeader>
          <Collapse isOpen={slotsOpen}>
            <CardBody>
              {pack.slots.map((filter, slotIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <InputGroup key={slotIndex} className={slotIndex !== 0 ? 'mt-3' : undefined}>
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>{slotIndex + 1}</InputGroupText>
                  </InputGroupAddon>
                  <Input
                    type="text"
                    value={filter}
                    onChange={mutations.changeSlot}
                    data-pack-index={packIndex}
                    data-slot-index={slotIndex}
                  />
                  {pack.slots.length > 1 && (
                    <InputGroupAddon addonType="append">
                      <Button
                        color="secondary"
                        outline
                        onClick={mutations.removeSlot}
                        data-pack-index={packIndex}
                        data-slot-index={slotIndex}
                      >
                        Remove
                      </Button>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              ))}
            </CardBody>
            <CardFooter>
              <Button className="mr-2" color="success" onClick={mutations.addSlot} data-pack-index={packIndex}>
                Add Card Slot
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
        <Card key="steps" className="mb-2 mx-1">
          <CardHeader onClick={toggleStepsOpen}>
            <CardTitle className="mb-0">Steps</CardTitle>
          </CardHeader>
          <Collapse isOpen={stepsOpen}>
            <CardBody>
              {steps.map((step, stepIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <InputGroup key={stepIndex}>
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>{stepIndex + 1}</InputGroupText>
                  </InputGroupAddon>
                  <UncontrolledDropdown className="pr-2">
                    <DropdownToggle caret>{ACTION_LABELS[step.action]}</DropdownToggle>
                    <DropdownMenu>
                      {Object.entries(ACTION_LABELS).map(([actionKey, actionLabel]) => (
                        <DropdownItem
                          key={actionKey}
                          value={actionKey}
                          onClick={mutations.changeStepAction}
                          data-pack-index={packIndex}
                          data-step-index={stepIndex}
                        >
                          {actionLabel}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </UncontrolledDropdown>
                  {step.action !== 'pass' && (
                    <>
                      <Input
                        type="number"
                        value={step.amount ?? ''}
                        onChange={mutations.changeStepAmount}
                        data-pack-index={packIndex}
                        data-step-index={stepIndex}
                      />
                      <Label className="px-2"> Card{step.amount !== 1 && 's'} </Label>
                    </>
                  )}
                  <InputGroupAddon addonType="append">
                    <Button
                      color="secondary"
                      outline
                      onClick={mutations.removeStep}
                      data-pack-index={packIndex}
                      data-step-index={stepIndex}
                    >
                      Remove
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              ))}
            </CardBody>
            <CardFooter>
              <Button className="mr-2" color="success" onClick={mutations.addStep} data-pack-index={packIndex}>
                Add Step
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
      </CardBody>
      <CardFooter>
        <Button className="mr-2" color="success" onClick={mutations.addSlot} data-pack-index={packIndex}>
          Add Card Slot
        </Button>
        <Button color="success" onClick={mutations.duplicatePack} data-pack-index={packIndex}>
          Duplicate Pack
        </Button>
      </CardFooter>
    </Card>
  );
};

CustomPackCard.propTypes = {
  packIndex: PropTypes.number.isRequired,
  pack: PropTypes.shape({
    slots: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    steps: PropTypes.arrayOf(
      PropTypes.shape({
        action: PropTypes.oneOf(['pick', 'pass', 'trash']).isRequired,
        amount: PropTypes.number,
      }).isRequired,
    ),
  }).isRequired,
  canRemove: PropTypes.bool,
  mutations: PropTypes.shape({
    removePack: PropTypes.func.isRequired,
    changeSlot: PropTypes.func.isRequired,
    removeSlot: PropTypes.func.isRequired,
    addSlot: PropTypes.func.isRequired,
    duplicatePack: PropTypes.func.isRequired,
    addStep: PropTypes.func.isRequired,
    changeStepAction: PropTypes.func.isRequired,
    changeStepAmount: PropTypes.func.isRequired,
    removeStep: PropTypes.func.isRequired,
  }).isRequired,
};
CustomPackCard.defaultProps = {
  canRemove: false,
};

export default CustomPackCard;
