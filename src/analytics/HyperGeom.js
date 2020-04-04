import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ChartComponent from 'react-chartjs-2';

import {
  Col,
  Row,
  Table,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  CustomInput,
  Card,
  CardBody,
  Input,
  Button,
} from 'reactstrap';

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
  const [popSuccesses, sePopSuccesses] = useState('');
  const [sampleSize, setSampleSize] = useState('');
  const [sampleSuccesses, setSampleSuccesses] = useState('');
  const [data, setData] = useState([]);
  const [xAxis, setXAxis] = useState('Number of successes in population');

  const [gte, setgte] = useState('');
  const [gt, setgt] = useState('');
  const [lt, setlt] = useState('');
  const [lte, setlte] = useState('');
  const [et, setet] = useState('');

  const factorial = (n) => {
    let total = 1;
    for (let i = 1; i <= n; i++) {
      total *= i;
    }
    return total;
  };

  const combination = (n, r) => {
    return factorial(n) / (factorial(r) * factorial(n - r));
  };

  const hyp = (N, S, n, s) => {
    return (combination(S, s) * combination(N - S, n - s)) / combination(N, n);
  };

  const clamp = (val, min, max) => {
    return Math.min(Math.max(val, min), max);
  };

  const calculate = (N, S, n, s) => {
    const keys = [...Array(parseInt(s, 10) + 1).keys()];
    const values = keys.map((x) => hyp(parseInt(N, 10), parseInt(S, 10), parseInt(n, 10), x));
    const equalTo = clamp(values[values.length - 1], 0, 1);
    const lessThan = clamp(values.reduce((a, b) => a + b, 0) - equalTo, 0, 1);
    const lessThanEqual = clamp(lessThan + equalTo, 0, 1);
    const greaterThan = 1 - clamp(lessThanEqual, 0, 1);
    const greaterThanEqual = clamp(greaterThan + equalTo, 0, 1);

    return { equalTo, lessThan, lessThanEqual, greaterThan, greaterThanEqual };
  };

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
        popSuccesses,
        sampleSize,
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

  console.log(length);

  const plotPopSize = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(i, dataset.popSuccesses, dataset.sampleSize, dataset.sampleSuccesses).greaterThanEqual);
    }
    return res;
  };
  const plotPopSuccess = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, i, dataset.sampleSize, dataset.sampleSuccesses).greaterThanEqual);
    }
    console.log(res);
    return res;
  };
  const plotSampleSize = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, dataset.popSuccesses, i, dataset.sampleSuccesses).greaterThanEqual);
    }
    return res;
  };
  const plotSampleSuccess = (dataset, size) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(calculate(dataset.populationSize, dataset.popSuccesses, dataset.sampleSize, i).greaterThanEqual);
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
  console.log(plotdata);

  return (
    <>
      <h4 className="d-lg-block d-none">Hypergeometric Calculator</h4>
      <p>
        This Hypergeometric Calculator makes it easy to compute individual and cumulative hypergeometric probabilities.
      </p>
      <p>The population is the entire cube.</p>
      <>
        <TextField
          name="1"
          humanName="Population size"
          placeholder=""
          value={populationSize}
          onChange={(event) => setPopulationSize(event.target.value)}
        />
        <TextField
          name="2"
          humanName="Number of successes in population"
          placeholder=""
          value={popSuccesses}
          onChange={(event) => sePopSuccesses(event.target.value, 10)}
        />
        <TextField
          name="2"
          humanName="Sample size"
          placeholder=""
          value={sampleSize}
          onChange={(event) => setSampleSize(event.target.value, 10)}
        />
        <TextField
          name="2"
          humanName="Number of successes in sample (x)"
          placeholder=""
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
