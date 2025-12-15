import React, { useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface Version {
  versionId: string;
  timestamp: Date;
  isLatest: boolean;
}

interface CubeRestorePageProps {
  cube: Cube;
  versions: Version[];
}

const CubeRestorePage: React.FC<CubeRestorePageProps> = ({ cube, versions }) => {
  const { csrfToken } = useContext(CSRFContext);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleRestoreClick = (versionId: string) => {
    setSelectedVersion(versionId);
    setShowModal(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedVersion) return;

    const formData = new FormData();
    formData.append('_csrf', csrfToken || '');
    formData.append('versionId', selectedVersion);

    try {
      const response = await fetch(`/cube/restore/${cube.id}`, {
        method: 'POST',
        body: formData,
      });

      if (response.redirected) {
        window.location.href = response.url;
      }
    } catch (error) {
      console.error('Error restoring cube:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="overview">
        <Flexbox direction="col" gap="2" className="mb-2">
          <DynamicFlash />
          <Card>
            <CardHeader>
              <Text semibold xl>
                Restore Cube
              </Text>
            </CardHeader>
            <CardBody>
              <Text>
                This page shows all available versions of your cube stored in backup. You can restore your cube to any
                previous version. Restoring will create a new changelog entry showing the differences between the
                current version and the restored version.
              </Text>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Text semibold lg>
                Available Versions ({versions.length})
              </Text>
            </CardHeader>
            <CardBody>
              {versions.length === 0 ? (
                <Text>No previous versions available.</Text>
              ) : (
                <Flexbox direction="col" gap="2">
                  {versions.map((version) => (
                    <Card key={version.versionId} className="border">
                      <CardBody>
                        <Row>
                          <Col xs={12} md={8}>
                            <Flexbox direction="col" gap="1">
                              <Flexbox direction="row" gap="2" alignItems="center">
                                <Text semibold md>
                                  {formatDate(version.timestamp.toString())}
                                </Text>
                                {version.isLatest && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded bg-accent text-bg-accent">
                                    Current
                                  </span>
                                )}
                              </Flexbox>
                              <Text sm className="text-muted">
                                Version ID: {version.versionId.substring(0, 16)}...
                              </Text>
                            </Flexbox>
                          </Col>
                          <Col xs={12} md={4}>
                            <Flexbox direction="row" justify="end" alignItems="center" className="h-full">
                              {version.isLatest ? (
                                <Button color="secondary" disabled>
                                  Current Version
                                </Button>
                              ) : (
                                <Button color="primary" onClick={() => handleRestoreClick(version.versionId)}>
                                  Restore This Version
                                </Button>
                              )}
                            </Flexbox>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  ))}
                </Flexbox>
              )}
            </CardBody>
          </Card>
        </Flexbox>

        <ConfirmActionModal
          isOpen={showModal}
          setOpen={setShowModal}
          title="Confirm Restore"
          message="Are you sure you want to restore your cube to this version? This will update your cube's card list and create a new changelog entry showing the changes."
          buttonText="Restore"
          onClick={handleConfirmRestore}
        />
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeRestorePage);
