import React, { useContext, useEffect, useState } from 'react';

import { PrintingPreference } from '@utils/datatypes/Card';
import { getLabels } from '@utils/sorting/Sort';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import CubeContext from 'contexts/CubeContext';

const visibilityHelp: Record<string, string> = {
  pu: 'Anyone can search for and see your cube',
  un: 'Anyone with a link can see your cube',
  pr: 'Only you can see your cube',
};

const OptionsSettings: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const [formData, setFormData] = useState<Record<string, string>>({
    priceVisibility: `${cube.priceVisibility === 'pu'}`,
    disableAlerts: `${cube.disableAlerts}`,
    visibility: cube.visibility,
    defaultStatus: cube.defaultStatus,
    defaultPrinting: cube.defaultPrinting,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const deleteFormRef = React.useRef<HTMLFormElement>(null);

  // Detect changes
  useEffect(() => {
    const initialData = {
      priceVisibility: `${cube.priceVisibility === 'pu'}`,
      disableAlerts: `${cube.disableAlerts}`,
      visibility: cube.visibility,
      defaultStatus: cube.defaultStatus,
      defaultPrinting: cube.defaultPrinting,
    };
    const currentData = {
      priceVisibility: formData.priceVisibility,
      disableAlerts: formData.disableAlerts,
      visibility: formData.visibility,
      defaultStatus: formData.defaultStatus,
      defaultPrinting: formData.defaultPrinting,
    };
    const changed = JSON.stringify(currentData) !== JSON.stringify(initialData);
    setHasChanges(changed);
  }, [formData, cube]);

  const resetChanges = () => {
    setFormData({
      priceVisibility: `${cube.priceVisibility === 'pu'}`,
      disableAlerts: `${cube.disableAlerts}`,
      visibility: cube.visibility,
      defaultStatus: cube.defaultStatus,
      defaultPrinting: cube.defaultPrinting,
    });
  };

  const trimmedCubeName = cube.name.trim();
  const trimmedInputName = deleteName.trim();
  const namesMatch = trimmedInputName === trimmedCubeName;

  return (
    <Flexbox direction="col" gap="3">
      <Card>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              Options
            </Text>
            <Flexbox direction="row" gap="2">
              <Button color="secondary" onClick={resetChanges} disabled={!hasChanges}>
                Reset
              </Button>
              <LoadingButton color="primary" onClick={() => formRef.current?.submit()} disabled={!hasChanges}>
                Save Changes
              </LoadingButton>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          <CSRFForm ref={formRef} formData={formData} method="POST" action={`/cube/updatesettings/${cube.id}`}>
            <Flexbox direction="col" gap="3">
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
              <div>
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
                <Text xs className="mt-1 text-muted">
                  {visibilityHelp[formData.visibility]}
                </Text>
              </div>
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

              <div className="mt-4 pt-4 border-t border-border">
                <Flexbox direction="row" justify="between" alignItems="center" className="mb-3">
                  <Text semibold lg className="text-danger">
                    Danger Zone
                  </Text>
                  <Button color="secondary" onClick={() => setShowDangerZone(!showDangerZone)}>
                    {showDangerZone ? 'Hide' : 'Show'}
                  </Button>
                </Flexbox>

                {showDangerZone && (
                  <Flexbox direction="col" gap="3">
                    <Text semibold md>
                      Delete this cube
                    </Text>
                    <Text sm className="text-text-secondary">
                      Once you delete a cube, there is no going back. Please be certain.
                    </Text>
                    {!showDeleteConfirm ? (
                      <Button color="danger" onClick={() => setShowDeleteConfirm(true)}>
                        Delete Cube
                      </Button>
                    ) : (
                      <div className="border border-danger rounded p-3">
                        <CSRFForm method="POST" action={`/cube/remove/${cube.id}`} formData={{}} ref={deleteFormRef}>
                          <Flexbox direction="col" gap="3">
                            <Text semibold>Are you sure you want to delete this cube?</Text>
                            <Text sm>
                              To delete, please type the name of the cube: <strong>{cube.name}</strong>
                            </Text>
                            <Input
                              value={deleteName}
                              onChange={(e) => setDeleteName(e.target.value)}
                              placeholder="Cube name"
                              valid={namesMatch}
                            />
                            <Flexbox direction="row" gap="2">
                              <Button
                                color="danger"
                                disabled={!namesMatch}
                                onClick={() => deleteFormRef.current?.submit()}
                              >
                                I understand, delete this cube
                              </Button>
                              <Button
                                color="secondary"
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteName('');
                                }}
                              >
                                Cancel
                              </Button>
                            </Flexbox>
                          </Flexbox>
                        </CSRFForm>
                      </div>
                    )}
                  </Flexbox>
                )}
              </div>
            </Flexbox>
          </CSRFForm>
        </CardBody>
      </Card>
    </Flexbox>
  );
};

export default OptionsSettings;
