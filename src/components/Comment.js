import React from 'react';

import CommentEntry from './CommentEntry';
import CommentsSection from './CommentsSection';
import AgeText from './AgeText';

class Comment extends React.Component {
  constructor(props) 
  {
      super(props);

      this.onPost = this.onPost.bind(this);

      this.childElement = React.createRef();
  }

  onPost(comment)
  {
    comment.index = this.props.comment.comments.length;
    this.props.comment.comments.push(comment);
    this.forceUpdate();
    this.childElement.current.expand();
  }

  render() {
    var comment = this.props.comment;
    return (
        <div className='comment'>
          <div className="form-group">
              {comment.ownerName ? <a href={'/user/view/'+comment.owner}><small>{comment.ownerName}</small></a> : <a><small>Anonymous</small></a>}
              {comment.timePosted && <a><small> -  <AgeText date={comment.timePosted}/></small></a>}
              <br></br>
              <a>{comment.content}</a>
              <div>
                <a className="comment-button mb-2 text-muted clickable">Delete</a>
                {' '}
                <CommentEntry id={this.props.id} position={this.props.position} onPost={this.onPost}>
                    <span className="comment-button mb-2 text-muted clickable">Reply</span>
                </CommentEntry>
              </div>
          </div>
          {comment.comments.length > 0 &&       
            <div className="pl-2 border-left">      
                <CommentsSection ref={this.childElement} className='pl-4' id={this.props.id} comments={comment.comments} position={this.props.position} expanded={comment.expanded ? true : false} />
            </div>
          }
        </div>
    );
  }
}

export default Comment