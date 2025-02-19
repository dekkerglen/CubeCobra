import React, { useContext, useState } from 'react';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import CubeContext from 'contexts/CubeContext';
import { PrintingPreference } from 'datatypes/Card';
import Cube from 'datatypes/Cube';

import { getLabels } from '../../utils/Sort';

interface CubeSettingsModalProps {
  addAlert: (color: string, message: string) => void;
  onCubeUpdate: (cube: Cube) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const visibilityHelp: Record<string, string> = {
  pu: 'Anyone can search for and see your cube',
  un: 'Anyone with a link can see your cube',
  pr: 'Only you can see your cube',
};

const CubeSettingsModal: React.FC<CubeSettingsModalProps> = ({ isOpen, setOpen }) => {
  const { cube } = useContext(CubeContext);
  const [formData, setFormData] = useState<Record<string, string>>({
    priceVisibility: `${cube.priceVisibility === 'pu'}`,
    disableAlerts: `${cube.disableAlerts}`,
    visibility: cube.visibility,
    defaultStatus: cube.defaultStatus,
    defaultPrinting: cube.defaultPrinting,
  });
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Edit Settings
        </Text>
      </ModalHeader>
      <ModalBody>
        <CSRFForm ref={formRef} formData={formData} method="POST" action={`/cube/updatesettings/${cube.id}`}>
          <Flexbox direction="col" gap="2">
            <Checkbox
              label="Show Total Prices"
              checked={formData.priceVisibility === 'true'}
              setChecked={(checked) => setFormData({ ...formData, priceVisibility: `${checked}` })}
            />
            <Checkbox
              label="Disable Draft Notifications"
              checked={formData.disableAlerts === 'true'}
              setChecked={(checked) => setFormData({ ...formData, disableAlerts: `${checked}` })}
            />
            <Select
              label="Cube Visibility"
              value={formData.visibility}
              setValue={(visibility) => setFormData({ ...formData, visibility })}
              options={[
                { value: 'pu', label: 'Public' },
                { value: 'un', label: 'Unlisted' },
                { value: 'pr', label: 'Private' },
              ]}
            />
            <Text xs>{visibilityHelp[formData.visibility]}</Text>
            <Select
              label="Default Status"
              value={formData.defaultStatus}
              setValue={(defaultStatus) => setFormData({ ...formData, defaultStatus })}
              options={getLabels(null, 'Status', false).map((status: string) => ({
                value: status,
                label: status,
              }))}
            />
            <Select
              label="Default Printing"
              value={formData.defaultPrinting}
              setValue={(defaultPrinting) => setFormData({ ...formData, defaultPrinting })}
              options={[
                { value: PrintingPreference.RECENT, label: 'Most Recent' },
                { value: PrintingPreference.FIRST, label: 'First' },
              ]}
            />
          </Flexbox>
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <LoadingButton block color="primary" onClick={() => formRef.current?.submit()}>
            Save Changes
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CubeSettingsModal;
