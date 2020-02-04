import React from 'react';

import { Collapse } from 'reactstrap';

import CommentEntry from './CommentEntry';
import CommentsSection from './CommentsSection';
import CommentContextMenu from './CommentContextMenu';
import AgeText from './AgeText';

class Comment extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isEdit: false,
      editValue: '',
      childExpanded: this.props.focused ? true : false,
      highlighted: this.props.focused ? this.props.focused.length == 0 : false,
    };

    this.onPost = this.onPost.bind(this);
    this.startEdit = this.startEdit.bind(this);
    this.stopEdit = this.stopEdit.bind(this);
    this.submitEdit = this.submitEdit.bind(this);
    this.submitDelete = this.submitDelete.bind(this);
    this.updateServerSide = this.updateServerSide.bind(this);
    this.toggleChildCollapse = this.toggleChildCollapse.bind(this);
  }

  onPost(comment) {
    comment.index = this.props.comment.comments.length;
    this.props.comment.comments.push(comment);
    this.forceUpdate();
    this.setState({
      childExpanded: true,
    });
  }

  submitEdit() {
    if (this.state.editValue.length > 0) {
      this.props.comment.content = this.state.editValue;
      this.props.comment.updated = true;
      //this -1000 (ms) is to prevent a strange date display bug
      this.props.comment.timePosted = new Date() - 1000;

      this.props.submitEdit(this.props.comment, this.props.position);
      this.setState({
        isEdit: false,
      });

      this.updateServerSide();
    }
  }

  submitDelete() {
    this.props.comment.content = '[comment deleted]';
    this.props.comment.updated = true;
    //this -1000 (ms) is to prevent a strange date display bug
    this.props.comment.timePosted = new Date() - 1000;
    this.props.comment.owner = null;
    this.props.comment.ownerName = null;

    this.props.submitEdit(this.props.comment, this.props.position);
    this.forceUpdate();

    this.updateServerSide();
  }

  async updateServerSide() {
    //send edit command to server
    await csrfFetch(`/cube/api/editcomment`, {
      method: 'POST',
      body: JSON.stringify({
        id: this.props.id,
        comment: this.props.comment,
        position: this.props.position,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch((err) => this.error(err));
  }

  startEdit() {
    this.setState({
      isEdit: true,
    });
  }

  stopEdit() {
    this.setState({
      isEdit: false,
    });
  }

  updateEditValue(evt) {
    this.setState({
      editValue: evt.target.value,
    });
  }

  toggleChildCollapse() {
    console.log('toggle');
    console.log(this.state);
    this.setState({
      childExpanded: !this.state.childExpanded,
    });
  }

  render() {
    var comment = this.props.comment;
    return (
      <div className="mb-1">
        <div className={'comment border mt-1 px-2' + (this.state.highlighted ? ' comment-highlighted' : '')}>
          {true ? (
            ''
          ) : (
            <a href={'/user/view/' + comment.owner}>
              <img className="profile-thumbnail mt-2 mr-2" src={comment.image} title={'Art by ' + comment.artist} />
            </a>
          )}
          <div className="form-group mb-1">
            {comment.ownerName ? (
              <a href={'/user/view/' + comment.owner}>
                <small>{comment.ownerName}</small>
              </a>
            ) : (
              <a>
                <small>Anonymous</small>
              </a>
            )}
            {comment.timePosted &&
              (comment.updated ? (
                <em>
                  <small>
                    {' '}
                    - Updated <AgeText date={comment.timePosted} />
                  </small>
                </em>
              ) : (
                <a>
                  <small>
                    {' '}
                    - <AgeText date={comment.timePosted} />
                  </small>
                </a>
              ))}
            {comment.owner == this.props.userid && (
              <div className="float-sm-right">
                <CommentContextMenu
                  className="float-sm-right"
                  comment={comment}
                  value="..."
                  edit={this.startEdit}
                  delete={this.submitDelete}
                />
              </div>
            )}
            <br></br>
            <Collapse isOpen={!this.state.isEdit}>
              <a>{comment.content}</a>
            </Collapse>
            <Collapse isOpen={this.state.isEdit}>
              <textarea
                value={this.state.inputValue}
                onChange={(evt) => this.updateEditValue(evt)}
                className="form-control"
                id="exampleFormControlTextarea1"
                rows="2"
                maxLength="500"
                defaultValue={comment.content}
              ></textarea>
              <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.submitEdit}>
                Submit
              </a>{' '}
              <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.stopEdit}>
                Cancel
              </a>
            </Collapse>
            {this.props.position.length < 20 && this.props.loggedIn && (
              <div>
                <CommentEntry
                  id={this.props.id}
                  position={this.props.position}
                  onPost={this.onPost}
                  submitUrl={this.props.submitUrl}
                >
                  <span className="comment-button mb-2 text-muted clickable">Reply</span>
                </CommentEntry>
              </div>
            )}
          </div>
        </div>
        {comment.comments.length > 0 && (
          <div className="pl-2 pt-1 pr-1 border-left border-right border-bottom">
            <CommentsSection
              className="pl-4"
              expanded={this.state.childExpanded}
              toggle={this.toggleChildCollapse}
              id={this.props.id}
              comments={comment.comments}
              position={this.props.position}
              userid={this.props.userid}
              loggedIn={this.props.loggedIn}
              submitEdit={this.props.submitEdit}
              focused={this.props.focused && this.props.focused.length > 0 ? this.props.focused : this.props.focused}
              submitUrl={this.props.submitUrl}
            />
          </div>
        )}
      </div>
    );
  }
}

export default Comment;
