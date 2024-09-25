/* eslint-disable react/prop-types */
import React, { useCallback, useContext, useMemo } from 'react';
import { Col, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap';

import { SortableContainer, SortableElement } from 'react-sortable-hoc';

import LoadingButton from 'components/LoadingButton';
import CubeContext, { TAG_COLORS } from 'contexts/CubeContext';
import { csrfFetch } from 'utils/CSRF';
import { arrayMove, getTagColorClass } from 'utils/Util';

const SortableItem = SortableElement(({ value }) => <div className="sortable-item">{value}</div>);

const SortableList = SortableContainer(({ items }) => {
  return (
    <div>
      {items.map(({ element, key }, index) => (
        <SortableItem key={key} index={index} value={element} />
      ))}
    </div>
  );
});

const TagColorRow = ({ tag, tagClass, value, onChange }) => (
  <Row className="tag-color-row">
    <Col>
      <span className={tagClass}>{tag}</span>
    </Col>
    <Col className="d-flex flex-column justify-content-center">
      <Input type="select" bsSize="sm" name={`tagcolor-${tag}`} value={value || 'none'} onChange={onChange}>
        {TAG_COLORS.map(([name, v]) => (
          <option key={v || 'none'} value={v || 'none'}>
            {name}
          </option>
        ))}
      </Input>
    </Col>
  </Row>
);

const TagColorsModal = ({ isOpen, toggle }) => {
  const { tagColors, setTagColors, showTagColors, updateShowTagColors, canEdit, cube } = useContext(CubeContext);
  const [loading, setLoading] = React.useState(false);
  const [modalColors, setModalColors] = React.useState([...tagColors]);

  const updateModalColors = useCallback(
    (colors) => {
      setLoading(true);
      return csrfFetch(`/cube/api/savetagcolors/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({ tag_colors: modalColors }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        if (response.ok) {
          setTagColors(colors);
        } else {
          console.error('Request failed.');
        }
        setLoading(false);
        toggle();
      });
    },
    [cube.id, setTagColors, modalColors, toggle],
  );

  const handleChangeColor = useCallback(
    (event) => {
      const { target } = event;
      const name = target.getAttribute('name');
      if (!name.startsWith('tagcolor-')) {
        return;
      }
      const tag = name.slice('tagcolor-'.length);
      const color = target.value === 'none' ? null : target.value;

      const result = [...modalColors];
      const index = modalColors.findIndex((tagColor) => tag === tagColor.tag);
      if (index > -1) {
        result[index] = { tag, color };
      } else {
        result.push({ tag, color });
      }
      setModalColors(result);
    },
    [modalColors, setModalColors],
  );

  const handleSortEnd = useCallback(
    ({ oldIndex, newIndex }) => {
      setModalColors(arrayMove(modalColors, oldIndex, newIndex));
    },
    [modalColors, setModalColors],
  );

  const editableRows = useMemo(
    () =>
      modalColors.map(({ tag, color }) => {
        const tagClass = `tag ${getTagColorClass(modalColors, tag)}`;
        return {
          element: <TagColorRow tag={tag} tagClass={tagClass} value={color} onChange={handleChangeColor} />,
          key: tag,
        };
      }),
    [modalColors, handleChangeColor],
  );

  const staticRows = useMemo(() => {
    modalColors.map(({ tag }) => {
      const tagClass = `me-2 tag ${getTagColorClass(modalColors, tag)}`;
      return (
        <span key={tag} className={tagClass}>
          {tag}
        </span>
      );
    });
  }, [modalColors]);

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>{canEdit ? 'Set Tag Colors' : 'Tag Colors'}</ModalHeader>
      <ModalBody>
        <Label>
          <Input
            type="checkbox"
            className="me-1"
            checked={showTagColors}
            onChange={(e) => updateShowTagColors(e.target.checked)}
          />
          Show Tag Colors in Card List
        </Label>
        {!canEdit ? (
          ''
        ) : (
          <em>(Drag the tags below into a priority order to use for cards that have more than one tag)</em>
        )}
        {!canEdit ? (
          staticRows
        ) : (
          <Row className="tag-color-container">
            <Col>
              <SortableList onSortEnd={handleSortEnd} items={editableRows} />
            </Col>
          </Row>
        )}
      </ModalBody>
      <ModalFooter>
        <LoadingButton block color="success" onClick={() => updateModalColors(modalColors)} loading={loading}>
          Save Changes
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

TagColorsModal.defaultProps = {
  canEdit: false,
};

export default TagColorsModal;
