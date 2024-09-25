import React, { useContext } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Input } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import LabelRow from 'components/LabelRow';
import CubeContext from 'contexts/CubeContext';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const GridDraftCard = () => {
  const { cube } = useContext(CubeContext);
  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startgriddraft/${cube.id}`}>
        <CardHeader>
          <CardTitle tag="h5" className="mb-0">
            Grid Draft
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="description-area">
            <p>Grid drafting is a strategic 2 player draft with completely open information.</p>
          </div>
          <LabelRow htmlFor="packs-grid" label="Number of packs">
            <Input type="select" name="packs" id="packs-grid" defaultValue="18">
              {rangeOptions(1, 30)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="type-grid" label="Type">
            <Input type="select" name="type" id="type-grid" defaultValue="18">
              <option value="bot">Against Bot</option>
              <option value="2playerlocal">2 Player Local</option>
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Button color="accent">Start Grid Draft</Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default GridDraftCard;
