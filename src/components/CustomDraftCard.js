import React, { useContext } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Input, UncontrolledCollapse } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import LabelRow from 'components/LabelRow';
import Markdown from 'components/Markdown';
import CubeContext from 'contexts/CubeContext';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const CustomDraftCard = ({
  format,
  onEditFormat,
  onDeleteFormat,
  onSetDefaultFormat,
  defaultDraftFormat,
  ...props
}) => {
  const { cube, canEdit } = useContext(CubeContext);
  const { index } = format;

  return (
    <Card {...props}>
      <CSRFForm method="POST" key="createDraft" action={`/cube/startdraft/${cube.id}`}>
        <CardHeader>
          <CardTitle tag="h5" className="mb-0">
            {defaultDraftFormat === index && 'Default Format: '}
            {format.title} (Custom Draft)
          </CardTitle>
        </CardHeader>
        <CardBody>
          {format.markdown ? (
            <div className="mb-3">
              <Markdown markdown={format.markdown} />
            </div>
          ) : (
            <div
              className="description-area"
              dangerouslySetInnerHTML={/* eslint-disable-line react/no-danger */ { __html: format.html }}
            />
          )}

          <LabelRow htmlFor={`seats-${index}`} label="Total seats">
            <Input type="select" name="seats" id={`seats-${index}`} defaultValue={format.defaultSeats ?? 8}>
              {rangeOptions(2, 17)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value={index} />
          <div className="justify-content-center align-items-center">
            <Button type="submit" color="accent" className="me-2">
              Start Draft
            </Button>
            {canEdit && (
              <>
                <Button color="accent" className="me-2" onClick={onEditFormat} data-index={index}>
                  Edit
                </Button>
                {defaultDraftFormat !== index && (
                  <Button color="accent" className="me-2" onClick={onSetDefaultFormat} data-index={index}>
                    Make Default
                  </Button>
                )}
                <Button color="unsafe" id={`deleteToggler-${index}`}>
                  Delete
                </Button>
                <UncontrolledCollapse toggler={`#deleteToggler-${index}`}>
                  <h6 className="my-4">Are you sure? This action cannot be undone.</h6>
                  <Button color="unsafe" onClick={onDeleteFormat} data-index={index}>
                    Yes, delete this format
                  </Button>
                </UncontrolledCollapse>
              </>
            )}
          </div>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

CustomDraftCard.propTypes = {
  format: PropTypes.shape({
    index: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    html: PropTypes.string,
    markdown: PropTypes.string,
    defaultSeats: PropTypes.number,
  }).isRequired,
  onEditFormat: PropTypes.func.isRequired,
  onDeleteFormat: PropTypes.func.isRequired,
  onSetDefaultFormat: PropTypes.func.isRequired,
  defaultDraftFormat: PropTypes.number.isRequired,
};

export default CustomDraftCard;
