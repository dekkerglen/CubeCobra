import React from 'react';

import { Collapse } from 'reactstrap';

import CommentEntry from './CommentEntry';
import CommentsSection from './CommentsSection';
import CommentContextMenu from './CommentContextMenu';
import AgeText from './AgeText';

class Comment extends React.Component {
  constructor(props) 
  {
      super(props);

      this.state = {
          isEdit: false,
          editValue: ''
      };

      this.onPost = this.onPost.bind(this);
      this.mouseOut = this.mouseOut.bind(this);
      this.mouseOver = this.mouseOver.bind(this);
      this.startEdit = this.startEdit.bind(this);
      this.stopEdit = this.stopEdit.bind(this);

      this.childElement = React.createRef();

      this.state = {
        hover: false
      };
  }

  onPost(comment)
  {
    comment.index = this.props.comment.comments.length;
    this.props.comment.comments.push(comment);
    this.forceUpdate();
    this.childElement.current.expand();
  }

  mouseOut(event) {
    this.setState({
      hover: false
    });
  }
  
  mouseOver(event) {
    event.stopPropagation();
      this.setState({
        hover: true
    });
  }

  startEdit()
  {
    this.setState({
      isEdit: true
    });
  }

  stopEdit()
  {
    this.setState({
      isEdit: false
    });
  }

  updateEditValue(evt) {
    this.setState({
      editValue: evt.target.value
    });
  }

  render() {
    var comment = this.props.comment;
    return (
      <div className='mb-1'>
        <div className={'comment border mt-1 px-2' + (this.state.hover ? ' highlight-hover' : ' highlight-nohover')}>
          <div className="form-group mb-1" onMouseLeave={(event) => this.mouseOut(event)} onMouseEnter={(event) => this.mouseOver(event)}>
              {comment.ownerName ? <a href={'/user/view/'+comment.owner}><small>{comment.ownerName}</small></a> : <a><small>Anonymous</small></a>}
              {comment.timePosted && <a><small> -  <AgeText date={comment.timePosted}/></small></a>}
              {comment.owner == this.props.userid &&
                <div className="float-sm-right">
                  <CommentContextMenu className="float-sm-right" comment={comment} value='...' edit={this.startEdit}/>
                </div>              
              }
              <br></br>              
              <Collapse isOpen={!this.state.isEdit}>
                <a>{comment.content}</a>
              </Collapse>
              <Collapse isOpen={this.state.isEdit}>
                  <textarea value={this.state.inputValue} onChange={evt => this.updateEditValue(evt)} className="form-control" id="exampleFormControlTextarea1" rows="2" maxLength="500" defaultValue={comment.content}></textarea>        
                  <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.submitEdit}>Submit</a>   
                  {' '}
                  <a className="comment-button ml-1 mt-1 text-muted clickable" onClick={this.stopEdit}>Cancel</a>   
              </Collapse>
              {(this.props.position.length < 6 && this.props.loggedIn) &&
              <div>
                <CommentEntry id={this.props.id} position={this.props.position} onPost={this.onPost}>
                    <span className="comment-button mb-2 text-muted clickable">Reply</span>
                </CommentEntry>
              </div>
              }
          </div>
        </div>
        {comment.comments.length > 0 &&       
          <div className="pl-2 pt-1 pr-1 border-left border-right border-bottom">      
              <CommentsSection ref={this.childElement} className='pl-4' id={this.props.id} comments={comment.comments} position={this.props.position} expanded={comment.expanded ? true : false} userid={this.props.userid}  loggedIn={this.props.loggedIn}/>
          </div>
        }
      </div>
    );
  }
}

export default Comment