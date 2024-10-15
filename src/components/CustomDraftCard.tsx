import CSRFForm from 'components/CSRFForm';
import Markdown from 'components/Markdown';
import CubeContext from 'contexts/CubeContext';
import { DraftFormat } from 'datatypes/Draft';
import React, { useContext, useMemo, useState } from 'react';
import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import ConfirmActionModal from './modals/ConfirmActionModal';
import CustomDraftFormatModal from './modals/CustomDraftFormatModal';
import withModal from './WithModal';
import { Flexbox } from 'components/base/Layout';

const EditFormatButton = withModal(Button, CustomDraftFormatModal);
const DeleteFormatButton = withModal(Button, ConfirmActionModal);

interface CustomDraftCardProps {
  format: DraftFormat;
  defaultDraftFormat: number;
  formatIndex: number;
}

const range = (lo: number, hi: number): number[] => Array.from(Array(hi - lo).keys()).map((n) => n + lo);

const CustomDraftCard: React.FC<CustomDraftCardProps> = ({ format, defaultDraftFormat, formatIndex }) => {
  const { cube, canEdit } = useContext(CubeContext);
  const [seats, setSeats] = useState('8');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      seats: `${seats}`,
      id: `${formatIndex}`,
    }),
    [seats],
  );

  return (
    <Card>
      <CSRFForm
        method="POST"
        key="createDraft"
        action={`/cube/startdraft/${cube.id}`}
        formData={formData}
        ref={formRef}
      >
        <CardHeader>
          <Text lg semibold>
            {defaultDraftFormat === formatIndex && 'Default Format: '}
            {format.title} (Custom Draft)
          </Text>
        </CardHeader>
        <CardBody>
          {format.markdown ? (
            <div className="mb-3">
              <Markdown markdown={format.markdown} />
            </div>
          ) : (
            <div className="description-area" dangerouslySetInnerHTML={{ __html: format.html ?? '' }} />
          )}
          <Select
            label="Total Seats"
            options={range(2, 17).map((i) => ({ value: `${i}`, label: `${i}` }))}
            value={seats}
            setValue={setSeats}
          />
        </CardBody>
        <CardFooter>
          <Flexbox gap="2" direction="row" justify="between">
            <Button type="submit" color="primary" block onClick={() => formRef.current?.submit()}>
              <span className="whitespace-nowrap">Start Draft</span>
            </Button>
            {canEdit && (
              <>
                <EditFormatButton block modalprops={{ formatIndex }} color="accent" className="whitespace-nowrap">
                  <span className="whitespace-nowrap">Edit</span>
                </EditFormatButton>
                {defaultDraftFormat !== formatIndex && (
                  <Button
                    block
                    color="accent"
                    type="link"
                    href={`/cube/${cube.id}/defaultdraftformat/${encodeURIComponent(formatIndex)}`}
                    data-formatIndex={formatIndex}
                  >
                    <span className="whitespace-nowrap">Make Default</span>
                  </Button>
                )}
                <DeleteFormatButton
                  block
                  color="danger"
                  modalprops={{
                    target: `/cube/format/remove/${cube.id}/${encodeURIComponent(formatIndex)}`,
                    title: 'Confirm Delete',
                    message: 'Are you sure you want to delete this draft format?',
                    buttonText: 'Delete',
                  }}
                >
                  <span className="whitespace-nowrap">Delete</span>
                </DeleteFormatButton>
              </>
            )}
          </Flexbox>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default CustomDraftCard;
