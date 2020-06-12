import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ChartComponent from 'react-chartjs-2';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput, Input, Button } from 'reactstrap';

import calculate from 'utils/CalculateHyperGeom';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText style={{ width: '20rem' }}>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

TextField.propTypes = {
  name: PropTypes.string.isRequired,
  humanName: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const TextDisplay = ({ humanName, value }) => (
  <InputGroup className="mb-3">
    <InputGroupAddon addonType="prepend">
      <InputGroupText style={{ width: '20rem' }}>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" disabled value={value} />
  </InputGroup>
);

TextDisplay.propTypes = {
  humanName: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

const inputs = [
  'Population size',
  'Number of successes in population',
  'Sample size',
  'Number of successes in sample (x)',
];

const HyperGeom = () => {
  const [populationSize, setPopulationSize] = useState('');
  const [popSuccesses, setPopSuccesses] = useState('');
  const [sampleSize, setSampleSize] = useState('');
  const [sampleSuccesses, setSampleSuccesses] = useState('');
  const [data, setData] = useState([]);
  const [xAxis, setXAxis] = useState('Number of successes in population');

  const [gte, setgte] = useState('');
  const [gt, setgt] = useState('');
  const [lt, setlt] = useState('');
  const [lte, setlte] = useState('');
  const [et, setet] = useState('');

  const percentify = (num) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  const clear = () => {
    setData([]);
  };

  const submit = () => {
    try {
      const { equalTo, lessThan, lessThanEqual, greaterThan, greaterThanEqual } = calculate(
        populationSize,
        sampleSize,
        popSuccesses,
        sampleSuccesses,
      );

      setet(percentify(equalTo));
      setlt(percentify(lessThan));
      setlte(percentify(lessThanEqual));
      setgt(percentify(greaterThan));
      setgte(percentify(greaterThanEqual));
      setData(
        data.concat([
          {
            name: `Trial ${data.length + 1}`,
            sampleSuccesses,
            populationSize,
            popSuccesses,
            sampleSize,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          },
        ]),
      );
    } catch (err) {
      setet(err);
      setlt(err);
      setlte(err);
      setgt(err);
      setgte(err);
    }
  };

  const options = {
    responsive: true,
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true,
    },
    scales: {
      xAxes: [
        {
          display: true,
          scaleLabel: {
            display: false,
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Probability',
          },
        },
      ],
    },
  };

  const possible = data.map((datapoint) => {
    switch (xAxis) {
      case inputs[0]:
        return datapoint.populationSize;
      case inputs[1]:
        return datapoint.popSuccesses;
      case inputs[2]:
        return datapoint.sampleSize;
      case inputs[3]:
        return datapoint.sampleSuccesses;
      default:
        return 0;
    }
  });
  const length = possible.length > 0 ? Math.max(...possible.map((x) => parseInt(x, 10))) + 1 : 0;

  const plotPopSize = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(i, dataset.sampleSize, dataset.popSuccesses, dataset.sampleSuccesses).greaterThanEqual);
    }
    return res;
  };
  const plotPopSuccess = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, dataset.sampleSize, i, dataset.sampleSuccesses).greaterThanEqual);
    }
    return res;
  };
  const plotSampleSize = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, i, dataset.popSuccesses, dataset.sampleSuccesses).greaterThanEqual);
    }
    return res;
  };
  const plotSampleSuccess = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, dataset.sampleSize, dataset.popSuccesses, i).greaterThanEqual);
    }
    return res;
  };

  const plotData = (dataset, size) => {
    switch (xAxis) {
      case inputs[0]:
        return plotPopSize(dataset, size);
      case inputs[1]:
        return plotPopSuccess(dataset, size);
      case inputs[2]:
        return plotSampleSize(dataset, size);
      case inputs[3]:
        return plotSampleSuccess(dataset, size);
      default:
        return [];
    }
  };

  const plotdata = {
    labels: [...Array(length).keys()],
    datasets: data.map((dataset) => ({
      label: dataset.name,
      borderColor: dataset.color,
      fill: false,
      data: plotData(dataset, length),
    })),
  };

  return (
    <>
      <h4 className="d-lg-block d-none">Hypergeometric Calculator</h4>
      <p>
        This Hypergeometric Calculator makes it easy to compute individual and cumulative hypergeometric probabilities.
        This can be useful to determine the probabilty to have a minimum amount of a certain type of card (e.g.
        cantrips) in a draft pool given the amount of those cards in the cube overall. Another use case is to calculate
        the probabilty of having cards of a certain type (e.g. aggro one-drops) in an opening hand of a deck, given the
        amount of those cards in the deck.
      </p>
      <p>
        View information on how to use this tool{' '}
        <a href="https://www.youtube.com/watch?v=lKYNtxrACRY" target="_blank" rel="noopener noreferrer">
          here
        </a>
        .
      </p>
      <>
        <TextField
          name="1"
          humanName="Population size"
          placeholder="e.g. the size of the cube"
          value={populationSize}
          onChange={(event) => setPopulationSize(event.target.value)}
        />
        <TextField
          name="2"
          humanName="Number of successes in population"
          placeholder="e.g. the amount of cards of a certain type in the cube"
          value={popSuccesses}
          onChange={(event) => setPopSuccesses(event.target.value, 10)}
        />
        <TextField
          name="2"
          humanName="Sample size"
          placeholder="e.g. the amount of cards in the draft pod"
          value={sampleSize}
          onChange={(event) => setSampleSize(event.target.value, 10)}
        />
        <TextField
          name="2"
          humanName="Number of successes in sample (x)"
          placeholder="e.g. the amount of cards in the draft pod that should be of the type"
          value={sampleSuccesses}
          onChange={(event) => setSampleSuccesses(event.target.value, 10)}
        />
        <Button className="mb-3" color="success" block onClick={submit}>
          Calculate
        </Button>
        <TextDisplay humanName={`Hypergeometric Probability: P(X = ${sampleSuccesses})`} value={et} />
        <TextDisplay humanName={`Cumulative Probability: P(X < ${sampleSuccesses})`} value={lt} />
        <TextDisplay humanName={`Cumulative Probability: P(X <= ${sampleSuccesses})`} value={lte} />
        <TextDisplay humanName={`Cumulative Probability: P(X > ${sampleSuccesses})`} value={gt} />
        <TextDisplay humanName={`Cumulative Probability: P(X >= ${sampleSuccesses})`} value={gte} />
        {data.length > 0 && (
          <>
            <h5>Cumulative Distributions</h5>
            <ChartComponent options={options} data={plotdata} type="line" />
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>X-Axis: </InputGroupText>
              </InputGroupAddon>
              <CustomInput type="select" value={xAxis} onChange={(event) => setXAxis(event.target.value)}>
                {inputs.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </CustomInput>
            </InputGroup>
            <h5>Datasets</h5>
            <Row>
              {data.map((datapoint) => (
                <Col xs="12" lg="6">
                  <Table bordered responsive className="mt-lg-3">
                    <thead>
                      <tr>
                        <th colSpan="2" scope="row">
                          {datapoint.name}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="breakdown">
                      <tr>
                        <th scope="col">Population size</th>
                        <td>{datapoint.populationSize}</td>
                      </tr>
                      <tr>
                        <th scope="col">Number of successes in population</th>
                        <td>{datapoint.popSuccesses}</td>
                      </tr>
                      <tr>
                        <th scope="col">Sample size</th>
                        <td>{datapoint.sampleSize}</td>
                      </tr>
                      <tr>
                        <th scope="col">Number of successes in sample (x)</th>
                        <td>{datapoint.sampleSuccesses}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
              ))}
            </Row>
            <Button className="mb-3" color="danger" block onClick={clear}>
              Reset
            </Button>
          </>
        )}
      </>
    </>
  );
};

export default HyperGeom;
