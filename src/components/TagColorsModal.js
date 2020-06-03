import React, { Component } from 'react';

import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import {
  Button,
  Col,
  Form,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Row,
} from 'reactstrap';

import { arrayMove } from '../utils/Util';

import LoadingButton from './LoadingButton';
import TagContext, { getTagColorClass, TAG_COLORS } from './TagContext';

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
      <div className={tagClass}>{tag}</div>
    </Col>
    <Col className="d-flex flex-column justify-content-center">
      <Input type="select" bsSize="sm" name={`tagcolor-${tag}`} value={value || 'none'} onChange={onChange}>
        {TAG_COLORS.map(([name, value]) => (
          <option key={value || 'none'} value={value || 'none'}>
            {name}
          </option>
        ))}
      </Input>
    </Col>
  </Row>
);

class TagColorsModalRaw extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tagColors: this.props.savedTagColors,
      showTagColors: this.props.savedShowTagColors,
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChangeColor = this.handleChangeColor.bind(this);
    this.handleChangeShowTagColors = this.handleChangeShowTagColors.bind(this);
    this.handleSortEnd = this.handleSortEnd.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();
    if (this.props.canEdit) {
      return Promise.all([
        this.props.setTagColors(this.state.tagColors),
        this.props.setShowTagColors(this.state.showTagColors),
      ]).then(() => this.props.toggle());
    } else {
      return this.props.setShowTagColors(this.state.showTagColors).then(() => this.props.toggle());
    }
  }

  handleChangeColor(event) {
    const target = event.target;
    const name = target.getAttribute('name');
    if (!name.startsWith('tagcolor-')) {
      return;
    }
    const tag = name.slice('tagcolor-'.length);
    const color = target.value === 'none' ? null : target.value;

    this.setState(({ tagColors }) => {
      const result = [...tagColors];
      const index = tagColors.findIndex((tagColor) => tag === tagColor.tag);
      if (index > -1) {
        result[index] = { tag, color };
      } else {
        result.push({ tag, color });
      }
      return {
        tagColors: result,
      };
    });
  }

  handleChangeShowTagColors(event) {
    const target = event.target;
    this.setState({
      showTagColors: target.checked,
    });
  }

  layoutTagColors() {
    const { allTags } = this.props;
    const { tagColors } = this.state;

    const knownTags = tagColors.map(({ tag }) => tag);
    const knownTagColors = tagColors.filter(({ tag }) => allTags.includes(tag));
    const unknownTags = allTags.filter((tag) => !knownTags.includes(tag));
    const unknownTagColors = unknownTags.map((tag) => ({ tag, color: null }));

    return [...knownTagColors, ...unknownTagColors];
  }

  handleSortEnd({ oldIndex, newIndex }) {
    const allTagColors = this.layoutTagColors();
    this.setState({
      tagColors: arrayMove(allTagColors, oldIndex, newIndex),
    });
  }

  render() {
    const { canEdit, isOpen, toggle, allTags } = this.props;
    const { tagColors, showTagColors } = this.state;

    const orderedTags = this.layoutTagColors();

    const editableRows = orderedTags.map(({ tag, color }) => {
      const tagClass = `tag ${getTagColorClass(tagColors, tag)}`;
      return {
        element: <TagColorRow tag={tag} tagClass={tagClass} value={color} onChange={this.handleChangeColor} />,
        key: tag,
      };
    });

    const staticRows = orderedTags.map(({ tag, color }) => {
      const tagClass = `mr-2 tag ${getTagColorClass(tagColors, tag)}`;
      return (
        <span key={tag} className={tagClass}>
          {tag}
        </span>
      );
    });

    return (
      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>{canEdit ? 'Set Tag Colors' : 'Tag Colors'}</ModalHeader>
        <ModalBody>
          <Form inline className="mb-2">
            <Label>
              <Input type="checkbox" checked={showTagColors} onChange={this.handleChangeShowTagColors} />
              Show Tag Colors in Card List
            </Label>
          </Form>
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
                <SortableList onSortEnd={this.handleSortEnd} items={editableRows} />
              </Col>
            </Row>
          )}
        </ModalBody>
        <ModalFooter>
          <LoadingButton color="success" className="ml-auto" onClick={this.handleSubmit}>
            Submit
          </LoadingButton>
        </ModalFooter>
      </Modal>
    );
  }
}

TagColorsModalRaw.defaultProps = {
  canEdit: false,
};

const TagColorsModal = (props) => (
  <TagContext.Consumer>
    {({ tagColors, setTagColors, showTagColors, setShowTagColors, allTags }) => (
      <TagColorsModalRaw
        allTags={allTags}
        savedTagColors={tagColors}
        setTagColors={setTagColors}
        savedShowTagColors={showTagColors}
        setShowTagColors={setShowTagColors}
        {...props}
      />
    )}
  </TagContext.Consumer>
);

export default TagColorsModal;
