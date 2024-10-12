import React, { useState } from 'react';
import CSRFForm from 'components/CSRFForm';
import Comment from 'datatypes/Comment';
import TextArea from './base/TextArea';
import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';
import Select from 'components/base/Select';
import Button from 'components/base/Button';
import { Flexbox } from './base/Layout';

interface ReportCommentModalProps {
  comment: Comment;
  isOpen: boolean;
  setOpen: (val: boolean) => void;
}

const ReportCommentModal: React.FC<ReportCommentModalProps> = ({ comment, isOpen, setOpen }) => {
  const [formData, setFormData] = useState({
    info: '',
    reason: 'This is spam or phishing',
    commentid: comment.id,
  });

  const formRef = React.useRef<HTMLFormElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    console.log(name, value);
    setFormData((prevState) => ({
      ...prevState,
      [id]: value,
    }));
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <CSRFForm method="POST" action="/comment/report" formData={formData} ref={formRef}>
        <ModalHeader setOpen={setOpen}>Report this Comment</ModalHeader>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Select
              label="Report Reason"
              id="reason"
              options={[
                {
                  value: 'This is spam or phishing',
                  label: 'This is spam or phishing',
                },
                {
                  value: 'This is offensive or abusive',
                  label: 'This is offensive or abusive',
                },
                {
                  value: 'It expresses intentions of self-harm or suicide',
                  label: 'It expresses intentions of self-harm or suicide',
                },
              ]}
              value={formData.reason}
              setValue={(val) =>
                setFormData((old) => ({
                  ...old,
                  reason: val,
                }))
              }
            />
            <TextArea
              className="w-100"
              id="info"
              name="info"
              placeholder="Put any additional comments here."
              value={formData.info}
              onChange={handleChange}
            />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" className="w-full" gap="2">
            <Button block color="accent" onClick={() => formRef.current?.submit()}>
              Submit Report
            </Button>
            <Button block color="danger" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default ReportCommentModal;
