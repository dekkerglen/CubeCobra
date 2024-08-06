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
  InputGroupText,
  Label,
  UncontrolledDropdown,
} from 'reactstrap';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
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

const CollapsibleCardTitle = ({ children, isOpen, ...props }) => {
  return (
    <CardTitle {...props}>
      {children}
      <span style={{ float: 'right' }}>{isOpen ? <ChevronUpIcon size={24} /> : <ChevronDownIcon size={24} />}</span>
    </CardTitle>
  );
};

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
    <Card key={packIndex} className="mb-4 pack-outline">
      <CardHeader>
        <CardTitle className="mb-0">
          Pack {packIndex + 1} - {pack.slots.length} cards
          {canRemove && <Button close onClick={mutations.removePack} data-pack-index={packIndex} />}
        </CardTitle>
      </CardHeader>
      <CardBody className="p-1">
        <Card key="slots" className="mb-3 m-2">
          <CardHeader onClick={toggleSlotsOpen}>
            <CollapsibleCardTitle isOpen={slotsOpen} className="mb-0">
              Card Slots
            </CollapsibleCardTitle>
          </CardHeader>
          <Collapse isOpen={slotsOpen}>
            <CardBody>
              {pack.slots.map((filter, slotIndex) => (
                <InputGroup key={slotIndex} className={slotIndex !== 0 ? 'mt-3' : undefined}>
                  <InputGroupText>{slotIndex + 1}</InputGroupText>
                  <Input
                    type="text"
                    value={filter}
                    onChange={mutations.changeSlot}
                    data-pack-index={packIndex}
                    data-slot-index={slotIndex}
                  />
                  {pack.slots.length > 1 && (
                    <Button
                      color="secondary"
                      outline
                      onClick={mutations.removeSlot}
                      data-pack-index={packIndex}
                      data-slot-index={slotIndex}
                    >
                      Remove
                    </Button>
                  )}
                </InputGroup>
              ))}
            </CardBody>
            <CardFooter>
              <Button className="me-2" color="accent" onClick={mutations.addSlot} data-pack-index={packIndex}>
                Add Card Slot
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
        <Card key="steps" className="m-2">
          <CardHeader onClick={toggleStepsOpen}>
            <CollapsibleCardTitle isOpen={stepsOpen} className="mb-0">
              Steps for Drafting
            </CollapsibleCardTitle>
          </CardHeader>
          <Collapse isOpen={stepsOpen}>
            <CardBody>
              {steps.map((step, stepIndex) => (
                <InputGroup key={stepIndex} className="pb-1">
                  <InputGroupText>{stepIndex + 1}</InputGroupText>
                  <UncontrolledDropdown className="pe-2">
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
                  <Button
                    color="secondary"
                    outline
                    onClick={mutations.removeStep}
                    data-pack-index={packIndex}
                    data-step-index={stepIndex}
                  >
                    Remove
                  </Button>
                </InputGroup>
              ))}
            </CardBody>
            <CardFooter>
              <Button className="me-2" color="accent" onClick={mutations.addStep} data-pack-index={packIndex}>
                Add Step
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
      </CardBody>
      <CardFooter>
        <Button color="accent" onClick={mutations.duplicatePack} data-pack-index={packIndex}>
          Duplicate Pack
        </Button>
      </CardFooter>
    </Card>
  );
};

CollapsibleCardTitle.propTypes = {
  children: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
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
