import React, { Component, useState, useCallback, useRef } from 'react';
import { TwitterPicker, ChromePicker } from 'react-color';

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
import TagContext, { getTagColorStyle } from './TagContext';

function EnableShowTagColorView ({showTagColors, onChange}) {
  const [enabled, setEnabled] = useState(showTagColors)

  function handleChangeShowTagColors(event) {
    const target = event.target;
    setEnabled(target.checked)
    onChange(target.checked)
  }

  return (
    <Form inline className="mb-2">
      <Label>
        <Input type="checkbox" checked={enabled} onChange={handleChangeShowTagColors} />
        Show Tag Colors in Card List
      </Label>
    </Form>
  )
}

function Tag({tagColor}) {
  const backgroundColor = tagColor.color ? tagColor.color : "#fff"
  return (
    <span className="mr-2 tag-item" style={{backgroundColor: backgroundColor}}>{tagColor.tag}</span>
  )
}

function EditableTag({tagColor, onChange}) {
  const [displayColorPicker, setDisplayColorPicker] = useState(false)
  const [pickedColor, setPickedColor] = useState(tagColor.color ? tagColor.color : "#fff")
  const [fontColor, setFontColor] = useState('black')

  function calculateContrastColor (color) {
    const luma = (
      (parseInt(color.substring(1, 3), 16) * 299) + 
      (parseInt(color.substring(3, 5), 16) * 587) + 
      (parseInt(color.substring(5, 7), 16) * 114)
    ) / 1000;
  
    return luma > 200 ? 'black' : 'white'
  }

  function handleClick() {
    setDisplayColorPicker(!displayColorPicker)
  }

  function handleClose() {
    setDisplayColorPicker(false);
  }

  function handleChangeComplete(color) {
    setPickedColor(color.hex)  
    setFontColor(calculateContrastColor(color.hex))
    tagColor.color = color.hex
    onChange(tagColor)
  }

  const popover = {
    position: 'absolute',
    zIndex: '1100',
  }
  const cover = {
    position: 'fixed',
    top: '0px',
    right: '0px',
    bottom: '0px',
    left: '0px',
  }

  return (
    <Row className="tag-color-row" style={{color: fontColor, backgroundColor: pickedColor}}>
      <Col>{tagColor.tag}</Col>
      <Col className="text-md-right">
      <Button style={{backgroundImage: "url(/content/paint-brush-icon.jpg)", backgroundSize: "contain"}} onClick={handleClick}>O</Button>
      { displayColorPicker ?
        <div style={ popover }>
        <div style={ cover } onClick={ handleClose }/>
          <TwitterPicker
            color={ pickedColor }
            onChangeComplete={ handleChangeComplete }
          />
        </div>
      : null }
      </Col>
    </Row>
  )
}

function TagColorsView ({tagColors}) {
  return (
    <div>
      {tagColors.map((tagColor) => 
        <Tag key={tagColor.tag}
             tagColor={tagColor} />
      )}
    </div>
  );
}

class EditableTagColorsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tagColors: this.props.tagColors,
      onChange: this.props.onChange,
    };

    this.handleChangeTagColor = this.handleChangeTagColor.bind(this);
    this.handleSortEnd = this.handleSortEnd.bind(this);
  }

  handleChangeTagColor(changedTagColor) {
    const { tagColors, onChange } = this.state;
    const index = tagColors.findIndex((tagColor) => changedTagColor.tag === tagColor.tag);
    if (index > -1) {
      tagColors[index] = changedTagColor;
    }

    onChange(tagColors)
  }

  handleSortEnd({ oldIndex, newIndex }) {
    const { tagColors, onChange } = this.state;
    const newTagColors = arrayMove(tagColors, oldIndex, newIndex)
    this.setState({
      tagColors: newTagColors
    });
    onChange(newTagColors)
  }

  render() {
    const { tagColors } = this.state;
    const editableTags = tagColors.map((tagColor) => {
      return {
        element: <EditableTag tagColor={tagColor} onChange={this.handleChangeTagColor}/>,
        key: tagColor.tag,
      };
    });

    return (
      <div>
        <em>(Drag the tags below into a priority order to use for cards that have more than one tag)</em>
        <Row className="tag-color-container">
          <Col>
            <SortableList items={editableTags}
                          distance={5}
                          onSortEnd={this.handleSortEnd}/>
          </Col>
        </Row>
      </div>
    )
  }
}

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

class TagColorsModalRaw extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      showTagColors: this.props.savedShowTagColors,
      tagColors: this.props.savedTagColors,
    };

    this.handleChangeShowTagColors = this.handleChangeShowTagColors.bind(this);
    this.handleChangeTagColors = this.handleChangeTagColors.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChangeShowTagColors(showTagColors) {
    this.setState({
      showTagColors: showTagColors,
    });
  }

  handleChangeTagColors(tagColors) {
    this.setState({
      tagColors: tagColors,
    });
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

  render() {
    const { canEdit, isOpen, toggle } = this.props;
    const { tagColors, showTagColors } = this.state;

    return (
      <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>{canEdit ? 'Set Tag Colors' : 'Tag Colors'}</ModalHeader>
      <ModalBody>
        <EnableShowTagColorView showTagColors={showTagColors}  onChange={this.handleChangeShowTagColors}/>
        {!canEdit ? (
          <TagColorsView tagColors={tagColors}/>
        ) : (
          <EditableTagColorsView tagColors={tagColors} onChange={this.handleChangeTagColors}/>
        )}
      </ModalBody>
      <ModalFooter>
        <LoadingButton color="success" className="ml-auto" onClick={this.handleSubmit}>
          Submit
        </LoadingButton>
      </ModalFooter>
    </Modal>
    )
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
