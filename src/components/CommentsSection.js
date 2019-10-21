import React from 'react';

import { Collapse } from 'reactstrap';

import Comment from './Comment';

class CommentsSection extends React.Component {
constructor(props) 
{
    super(props);
    
    this.state = {collapse: false};
    this.toggle = this.toggle.bind(this);
}
  
toggle() {    
    this.setState({ collapse: !this.state.collapse });
}

expand() {
    this.setState({ collapse: true });
}

render() {
    var comments = this.props.comments;
    return (
        <>
        {comments.length > 0 && 
            <>
                <h6 className="comment-button mb-2 text-muted clickable" onClick={this.toggle}>{this.state.collapse ? 'Hide' : 'View'} Replies ({comments.length})</h6>    
                <Collapse isOpen={this.state.collapse}>
                    {comments.map(comment =>
                        <Comment id={this.props.id} position={this.props.position.concat([comment.index])} comment={comment} />
                    )}
                </Collapse>
            </>
        }
        </>
    );
  }
}

export default CommentsSection