import React, { useContext } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Input } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import LabelRow from 'components/LabelRow';
import CubeContext from 'contexts/CubeContext';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const SealedCard = () => {
  const { cube } = useContext(CubeContext);
  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startsealed/${cube.id}`}>
        <CardHeader>
          <CardTitle tag="h5" className="mb-0">
            Standard Sealed
          </CardTitle>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="packs-sealed" label="Number of packs">
            <Input type="select" name="packs" id="packs-sealed" defaultValue="6">
              {rangeOptions(1, 16)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="cards-sealed" label="Cards per pack">
            <Input type="select" name="cards" id="cards-sealed" defaultValue="15">
              {rangeOptions(5, 25)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Button color="accent">Start Sealed</Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default SealedCard;
