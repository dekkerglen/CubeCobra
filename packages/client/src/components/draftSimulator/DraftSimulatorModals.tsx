import React from 'react';

import type { SimulationRunEntry } from '@utils/datatypes/SimulationReport';

import Button from '../base/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import { Flexbox } from '../base/Layout';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';

export const PriorRunDeleteModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  run: SimulationRunEntry | null;
  onConfirm: (ts: number) => Promise<void>;
}> = ({ isOpen, setOpen, run, onConfirm }) => {
  if (!run) return null;

  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      setOpen={setOpen}
      text={`Delete the local simulation run from ${new Date(run.generatedAt).toLocaleString()}? This action cannot be undone.`}
      submitDelete={async () => {
        await onConfirm(run.ts);
        setOpen(false);
      }}
    />
  );
};

export const ClearSimulationHistoryModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}> = ({ isOpen, setOpen, onConfirm }) => (
  <ConfirmDeleteModal
    isOpen={isOpen}
    setOpen={setOpen}
    text="Clear all local simulation history for this cube? This only affects this browser and cannot be undone."
    submitDelete={async () => {
      await onConfirm();
      setOpen(false);
    }}
  />
);

export const LeaveSimulationModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onLeave: () => void;
}> = ({ isOpen, setOpen, onLeave }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md offsetClassName="pt-12 md:pt-20">
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Leave Simulator?
        </Text>
      </ModalHeader>
      <ModalBody>
        <Text>A simulation is still running. If you leave this page now, the current run will be interrupted.</Text>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" className="w-full justify-end" gap="2">
          <Button color="danger" onClick={onLeave}>
            Leave Page
          </Button>
          <Button color="secondary" onClick={() => setOpen(false)}>
            Stay Here
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};
