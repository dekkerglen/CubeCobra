import React, { useCallback } from 'react';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import RadioButtonGroup from 'components/base/RadioButtonGroup';
import Text from 'components/base/Text';

export interface ListViewColumn {
  key: string;
  label: string;
}

interface ListViewSettingsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
  columns: ListViewColumn[];
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  defaultVisibleColumns: string[];
}

const ListViewSettingsModal: React.FC<ListViewSettingsModalProps> = ({
  isOpen,
  setOpen,
  pageSize,
  setPageSize,
  pageSizeOptions,
  columns,
  visibleColumns,
  setVisibleColumns,
  defaultVisibleColumns,
}) => {
  const toggleColumn = useCallback(
    (key: string, checked: boolean) => {
      if (checked) {
        // Preserve the canonical column order when adding a column back.
        setVisibleColumns(
          columns.filter((col) => col.key === key || visibleColumns.includes(col.key)).map((col) => col.key),
        );
      } else {
        setVisibleColumns(visibleColumns.filter((c) => c !== key));
      }
    },
    [columns, visibleColumns, setVisibleColumns],
  );

  return (
    <Modal md isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>List View Settings</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="4">
          <Flexbox direction="col" gap="2">
            <Text semibold md>
              Page size
            </Text>
            <RadioButtonGroup
              options={pageSizeOptions.map((size) => ({ value: `${size}`, label: `${size} cards` }))}
              selected={`${pageSize}`}
              setSelected={(value) => setPageSize(parseInt(value, 10))}
            />
          </Flexbox>
          <Flexbox direction="col" gap="2">
            <Text semibold md>
              Displayed columns
            </Text>
            <Text sm className="text-text-secondary">
              Choose which columns to display. The Name column is always shown.
            </Text>
            <Row>
              {columns.map((column) => (
                <Col key={column.key} xs={6} className="py-1">
                  <Checkbox
                    label={column.label}
                    checked={visibleColumns.includes(column.key)}
                    setChecked={(checked) => toggleColumn(column.key, checked)}
                  />
                </Col>
              ))}
            </Row>
          </Flexbox>
        </Flexbox>
      </ModalBody>
      <ModalFooter className="justify-between">
        <Button color="secondary" onClick={() => setVisibleColumns(defaultVisibleColumns)}>
          Reset to defaults
        </Button>
        <Button color="primary" onClick={() => setOpen(false)}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ListViewSettingsModal;
