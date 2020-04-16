import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import useToggle from 'hooks/UseToggle';
import CSRFForm from 'components/CSRFForm';
import FilterCollapse from 'components/FilterCollapse';
import TextField from 'components/TextField';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Card, Input } from 'reactstrap';

const ResizeModal = ({ cubeID }) => {
  const [open, toggleOpen] = useToggle(false);
  const [size, setSize] = useState('720');
  const [filter, setFilter] = useState('');
  const [valid, setValid] = useState(true);

  useEffect(() => {
    /* eslint-disable-next-line */
    setValid(!isNaN(parseInt(size, 10)) && isFinite(size));
  }, [size]);

  return (
    <>
      <Button color="success" className="mb-2 mr-2" onClick={toggleOpen}>
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
              onChange={(event) => setSize(event.target.value)}
            />
            <Input type="hidden" name="filter" value={JSON.stringify(filter)} />
            <Card className="p-3">
              <h5>Filter for restrictions:</h5>
              <p>
                If you include a filter, this will only add or remove cards that match the filter. If there are not
                enough cards found to add or remove, your target size may not be reached.
              </p>
              <FilterCollapse defaultFilterText="" filter={filter} setFilter={setFilter} isOpen />
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button color="success" type="submit" disabled={!valid}>
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

ResizeModal.propTypes = {
  cubeID: PropTypes.string.isRequired,
};

export default ResizeModal;
