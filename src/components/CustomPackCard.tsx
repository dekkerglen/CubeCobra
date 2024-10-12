import React, { useMemo } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
import { buildDefaultSteps, DEFAULT_STEPS, DraftAction, Pack } from 'datatypes/Draft';
import useToggle from 'hooks/UseToggle';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import Collapse from './base/Collapse';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import Select from './base/Select';
import Text from './base/Text';

interface CustomPackCardProps {
  packIndex: number;
  pack: Pack;
  canRemove: boolean;
  setPack: (pack: Pack) => void;
  removePack: () => void;
  copyPack: () => void;
}

const ACTION_LABELS: Record<string, string> = Object.freeze({
  pick: 'Pick',
  pass: 'Pass',
  trash: 'Trash',
  pickrandom: 'Randomly Pick',
  trashrandom: 'Randomly Trash',
});

const CollapsibleCardTitle: React.FC<{ children: React.ReactNode; isOpen: boolean }> = ({ children, isOpen }) => {
  return (
    <Text semibold lg>
      {children}
      <span style={{ float: 'right' }}>{isOpen ? <ChevronUpIcon size={24} /> : <ChevronDownIcon size={24} />}</span>
    </Text>
  );
};

const CustomPackCard: React.FC<CustomPackCardProps> = ({
  packIndex,
  pack,
  canRemove,
  setPack,
  removePack,
  copyPack,
}) => {
  const [slotsOpen, toggleSlotsOpen] = useToggle(true);
  const [stepsOpen, toggleStepsOpen] = useToggle(false);
  const steps = useMemo(() => pack.steps ?? buildDefaultSteps(pack.slots.length), [pack]);
  return (
    <Card key={packIndex} className="mb-4 pack-outline">
      <CardHeader>
        <Flexbox direction="row" gap="2" className="w-full" justify="between">
          <Text semibold lg>
            Pack {packIndex + 1} - {pack.slots.length} cards
          </Text>
          {canRemove && (
            <Button color="danger" onClick={removePack}>
              Remove Pack
            </Button>
          )}
        </Flexbox>
      </CardHeader>
      <CardBody className="p-1">
        <Card key="slots" className="mb-3 m-2">
          <CardHeader onClick={toggleSlotsOpen}>
            <CollapsibleCardTitle isOpen={slotsOpen}>Card Slots</CollapsibleCardTitle>
          </CardHeader>
          <Collapse isOpen={slotsOpen}>
            <CardBody>
              <Flexbox direction="col" gap="2">
                {pack.slots.map((filter, slotIndex) => (
                  <Flexbox direction="row" gap="2" className="w-full" key={slotIndex} alignItems="center">
                    <Text semibold md>
                      {slotIndex + 1}
                    </Text>
                    <Input
                      type="text"
                      value={filter}
                      onChange={(e) => {
                        const newSlots = [...pack.slots];
                        newSlots[slotIndex] = e.target.value;
                        setPack({ ...pack, slots: newSlots });
                      }}
                    />
                    {pack.slots.length > 1 && (
                      <Button
                        color="secondary"
                        outline
                        onClick={() => {
                          const newSlots = [...pack.slots];
                          newSlots.splice(slotIndex, 1);
                          setPack({ ...pack, slots: newSlots });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </Flexbox>
                ))}
              </Flexbox>
            </CardBody>
            <CardFooter>
              <Button
                className="me-2"
                color="accent"
                onClick={() => {
                  setPack({ ...pack, slots: [...pack.slots, ''] });
                }}
                data-pack-index={packIndex}
              >
                Add Card Slot
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
        <Card key="steps" className="m-2">
          <CardHeader onClick={toggleStepsOpen}>
            <CollapsibleCardTitle isOpen={stepsOpen}>Steps for Drafting</CollapsibleCardTitle>
          </CardHeader>
          <Collapse isOpen={stepsOpen}>
            <CardBody>
              <Flexbox direction="col" gap="2">
                {steps.map((step, stepIndex) => (
                  <Flexbox direction="row" gap="2" className="w-full" key={stepIndex} alignItems="center">
                    <Text semibold md>
                      {stepIndex + 1}
                    </Text>
                    <Select
                      value={step.action}
                      options={Object.entries(ACTION_LABELS).map(([key, label]) => ({ value: key, label }))}
                      setValue={(value) => {
                        const newSteps = [...steps];
                        newSteps[stepIndex] = { ...step, action: value as DraftAction };
                        setPack({ ...pack, steps: newSteps });
                      }}
                    />
                    {step.action !== 'pass' && (
                      <>
                        <Input
                          type="number"
                          value={`${step.amount ?? ''}`}
                          onChange={(e) => {
                            const newSteps = [...steps];
                            newSteps[stepIndex] = {
                              ...step,
                              amount: e.target.value ? parseInt(e.target.value, 10) : null,
                            };
                            setPack({ ...pack, steps: newSteps });
                          }}
                        />
                        <Text md> Card{step.amount !== 1 && 's'} </Text>
                      </>
                    )}
                    <Button
                      color="secondary"
                      outline
                      onClick={() => {
                        const newSteps = [...steps];
                        newSteps.splice(stepIndex, 1);
                        setPack({ ...pack, steps: newSteps });
                      }}
                    >
                      Remove
                    </Button>
                  </Flexbox>
                ))}
              </Flexbox>
            </CardBody>
            <CardFooter>
              <Button
                className="me-2"
                color="accent"
                onClick={() => setPack({ ...pack, steps: [...steps, ...DEFAULT_STEPS] })}
              >
                Add Step
              </Button>
            </CardFooter>
          </Collapse>
        </Card>
      </CardBody>
      <CardFooter>
        <Button color="accent" onClick={copyPack}>
          Duplicate Pack
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CustomPackCard;
