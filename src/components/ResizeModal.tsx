import React, { useState, useEffect } from 'react';
import useToggle from 'hooks/UseToggle';
import CSRFForm from 'components/CSRFForm';
import FilterCollapse from 'components/FilterCollapse';
import TextField from 'components/TextField';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Card, Input } from 'reactstrap';

export interface ResizeModalProps {
  cubeID: string;
}

const ResizeModal: React.FC<ResizeModalProps> = ({ cubeID }) => {
  const [open, toggleOpen] = useToggle(false);
  const [size, setSize] = useState<string>('720');
  const [filter, setFilter] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');
  const [valid, setValid] = useState<boolean>(true);

  useEffect(() => {
    setValid(!isNaN(parseInt(size, 10)) && isFinite(parseInt(size, 10)));
  }, [size]);

  return (
    <>
      <Button color="accent" className="mb-2 me-2" onClick={toggleOpen}>
        Resize
      </Button>
      <Modal isOpen={open} toggle={toggleOpen} size="lg">
        <ModalHeader toggle={toggleOpen}>Resize Cube</ModalHeader>
        <CSRFForm method="POST" action={`/cube/resize/${cubeID}/${size}`} encType="multipart/form-data">
          <ModalBody>
            <p>
              Resize your cube to the set size. This will add or remove cards from the suggestions found in the
              recommender analysis tab in order to reach the requested size. For best results, don't use large deltas
              (20 to 360 won't be great).
            </p>
            <TextField
              name="size"
              humanName="New Size"
              value={size}
              valid={size.length > 0 && valid}
              invalid={size.length > 0 && !valid}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSize(event.target.value)}
            />
            <Input type="hidden" name="filter" value={filterText} />
            <Card className="p-3">
              <h5>Filter for restrictions:</h5>
              <p>
                If you include a filter, this will only add or remove cards that match the filter. If there are not
                enough cards found to add or remove, your target size may not be reached.
              </p>
              <FilterCollapse
                defaultFilterText=""
                filter={filter}
                setFilter={(newFilter: string, newFilterText: string) => {
                  setFilter(newFilter);
                  setFilterText(newFilterText);
                }}
                isOpen
              />
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button color="accent" type="submit" disabled={!valid}>
              Resize
            </Button>
            <Button color="secondary" onClick={toggleOpen}>
              Close
            </Button>
          </ModalFooter>
        </CSRFForm>
      </Modal>
    </>
  );
};

export default ResizeModal;
