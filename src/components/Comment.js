import React from 'react';

import CommentEntry from './CommentEntry';
import CommentsSection from './CommentsSection';
import CommentContextMenu from './CommentContextMenu';
import AgeText from './AgeText';

class Comment extends React.Component {
  constructor(props) 
  {
      super(props);

      this.onPost = this.onPost.bind(this);
      this.mouseOut = this.mouseOut.bind(this);
      this.mouseOver = this.mouseOver.bind(this);

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

  render() {
    var comment = this.props.comment;
    return (
        <div className={'comment border px-1 mb-1' + (this.state.hover ? ' highlight-hover' : ' highlight-nohover')}>
          <div className="form-group mb-1" onMouseLeave={(event) => this.mouseOut(event)} onMouseEnter={(event) => this.mouseOver(event)}>
              {comment.ownerName ? <a href={'/user/view/'+comment.owner}><small>{comment.ownerName}</small></a> : <a><small>Anonymous</small></a>}
              {comment.timePosted && <a><small> -  <AgeText date={comment.timePosted}/></small></a>}
              <div className="float-sm-right">
                <CommentContextMenu className="float-sm-right" comment={comment} value='...'/>
              </div>
              <br></br>
              <a>{comment.content}</a>
              {this.props.position.length < 6 &&
              <div>
                <CommentEntry id={this.props.id} position={this.props.position} onPost={this.onPost}>
                    <span className="comment-button mb-2 text-muted clickable">Reply</span>
                </CommentEntry>
              </div>
              }
          </div>
          {comment.comments.length > 0 &&       
            <div className="pl-2">      
                <CommentsSection ref={this.childElement} className='pl-4' id={this.props.id} comments={comment.comments} position={this.props.position} expanded={comment.expanded ? true : false} />
            </div>
          }
        </div>
    );
  }
}

export default Comment