import React, { useContext, useState } from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

interface Version {
  versionId: string;
  timestamp: Date;
  isLatest: boolean;
}

interface RestoreSettingsProps {
  versions: Version[];
}

const RestoreSettings: React.FC<RestoreSettingsProps> = ({ versions }) => {
  const { cube } = useContext(CubeContext);
  const { csrfToken } = useContext(CSRFContext);
  const [loading, setLoading] = useState<string | null>(null);

  const handleRestore = async (versionId: string) => {
    if (
      !confirm(
        "Are you sure you want to restore your cube to this version? This will update your cube's card list and create a new changelog entry.",
      )
    ) {
      return;
    }

    setLoading(versionId);
    const formData = new FormData();
    formData.append('_csrf', csrfToken || '');
    formData.append('versionId', versionId);

    try {
      const response = await fetch(`/cube/restore/${cube.id}`, {
        method: 'POST',
        body: formData,
      });

      if (response.redirected) {
        window.location.href = response.url;
      } else if (response.ok) {
        window.location.href = `/cube/settings/${cube.id}?view=restore`;
      }
    } catch (error) {
      console.error('Error restoring cube:', error);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateString: string | Date) => {
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
    <Card>
      <CardHeader>
        <Text semibold lg>
          Restore Cube
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="3">
          <Text>
            This page shows all available versions of your cube stored in backup. You can restore your cube to any
            previous version. Restoring will create a new changelog entry showing the differences between the current
            version and the restored version.
          </Text>

          <div>
            <Text semibold md className="mb-2">
              Available Versions ({versions.length})
            </Text>
            {versions.length === 0 ? (
              <Text className="text-muted">No previous versions available.</Text>
            ) : (
              <Flexbox direction="col" gap="2">
                {versions.map((version) => (
                  <div key={version.versionId} className="border border-border rounded p-3">
                    <Row>
                      <Col xs={12} md={8}>
                        <Flexbox direction="col" gap="1">
                          <Flexbox direction="row" gap="2" alignItems="center">
                            <Text semibold md>
                              {formatDate(version.timestamp)}
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
                            <Button
                              color="primary"
                              onClick={() => handleRestore(version.versionId)}
                              disabled={loading !== null}
                            >
                              {loading === version.versionId ? 'Restoring...' : 'Restore This Version'}
                            </Button>
                          )}
                        </Flexbox>
                      </Col>
                    </Row>
                  </div>
                ))}
              </Flexbox>
            )}
          </div>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default RestoreSettings;
