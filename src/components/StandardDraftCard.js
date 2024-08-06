import React, { useContext } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Input } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import LabelRow from 'components/LabelRow';
import CubeContext from 'contexts/CubeContext';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const StandardDraftCard = ({ onSetDefaultFormat, defaultDraftFormat }) => {
  const { cube, canEdit } = useContext(CubeContext);

  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startdraft/${cube.id}`}>
        <CardHeader>
          <CardTitle tag="h5" className="mb-0">
            {defaultDraftFormat === -1 && 'Default Format: '}Standard Draft
          </CardTitle>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="packs" label="Number of packs">
            <Input type="select" name="packs" id="packs" defaultValue="3">
              {rangeOptions(1, 16)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="cards" label="Cards per pack">
            <Input type="select" name="cards" id="cards" defaultValue="15">
              {rangeOptions(1, 25)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="seats" label="Total seats">
            <Input type="select" name="seats" id="seats" defaultValue="8">
              {rangeOptions(2, 17)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value="-1" />
          <div className="justify-content-center align-items-center">
            <Button color="accent" className="me-2">
              Start Draft
            </Button>
            {canEdit && defaultDraftFormat !== -1 && (
              <Button color="accent" className="me-3" onClick={onSetDefaultFormat} data-index={-1}>
                Make Default
              </Button>
            )}
          </div>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

StandardDraftCard.propTypes = {
  onSetDefaultFormat: PropTypes.func.isRequired,
  defaultDraftFormat: PropTypes.number.isRequired,
};

export default StandardDraftCard;
