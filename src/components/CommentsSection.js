import React from 'react';

import { Collapse } from 'reactstrap';

import Comment from './Comment';
import PagedList from './PagedList';

class CommentsSection extends React.Component {
constructor(props) 
{
    super(props);
}

render() {
    var comments = this.props.comments;
    return (comments.length > 0 && 
        <>
            <h6 className="comment-button mb-2 text-muted clickable" onClick={this.props.toggle}>{this.props.expanded ? 'Hide' : 'View'} Replies ({comments.length})</h6>    
            <Collapse isOpen={this.props.expanded}>   
                <PagedList pageSize={10} rows={comments.slice(0).reverse().map(comment =>
                    <Comment 
                    key={comment.index} 
                    id={this.props.id} 
                    focused={(this.props.focused && this.props.focused[0] == comment.index) ? this.props.focused.slice(1): null}
                    position={this.props.position.concat([comment.index])} 
                    comment={comment} 
                    userid={this.props.userid} 
                    loggedIn={this.props.loggedIn} 
                    submitEdit={this.props.submitEdit}/>
                )}>
                </PagedList>                        
            </Collapse>
        </>
    );
  }
}

export default CommentsSection