import React from 'react';
import { ListGroupItem, Collapse } from 'reactstrap';
import BlogContextMenu from './BlogContextMenu';
import CommentsSection from './CommentsSection';
import CommentEntry from './CommentEntry';

class BlogPost extends React.Component {
  constructor(props) {
    super(props);    
    
    this.onPost = this.onPost.bind(this);
    this.submitEdit = this.submitEdit.bind(this);

    this.childElement = React.createRef();
  }
  
  error(message) {
    console.log(message);
  }

  onPost(comment)
  {
    comment.index = this.props.post.comments.length;
    this.props.post.comments.push(comment);
    this.childElement.current.expand();
  }

  saveEdit(comments, position, comment)
  {      
    if(position.length == 1)
    {
        comments[position[0]] = comment;
    }
    else if(position.length > 1)
    {
        this.saveEdit(comments[position[0]].comments, position.slice(1), comment);
    }
  }

  async submitEdit(comment, position)
  {
    //update current state
    this.saveEdit(this.props.post.comments, position, comment);
  }

  render() {
    var post = this.props.post;
    return (
        <div className="card shadowed rounded-0 mt-3">
            <div className="card-header pl-4 pr-0 pt-2 pb-0">
                <h5 className="card-title">{post.title}<div className="float-sm-right">
                    {this.props.canEdit &&             
                    <BlogContextMenu className="float-sm-right" post={post} value='...'/>
                    }
                </div></h5>
                <h6 className="card-subtitle mb-2 text-muted">{post.date_formatted}</h6>                  
            </div>
            {(post.changelist && post.html) ? 
            <div className="row no-gutters">
                <div className="col col-12 col-l-3 col-md-3 col-sm-12" style={{'borderRight': '1px solid #DFDFDF'}}>
                    <div className="card-body py-2">
                        <p className="card-text">
                        <a dangerouslySetInnerHTML={{__html: post.changelist}}></a>
                        </p>
                    </div>
                </div>                     
                <div className="col col-9">
                    <div className="card-body py-2">
                        <div className="card-text">
                        <a dangerouslySetInnerHTML={{__html: post.html}}></a>
                        </div>
                    </div>
                </div>
            </div>
            : 
            <div className="card-body py-2">
                {post.changelist &&
                <p className="card-text">
                    <a dangerouslySetInnerHTML={{__html: post.changelist}}></a>
                </p>
                }
                {post.body &&
                <p className="card-text">{post.body}</p>
                }
                {post.html &&
                <div className="card-text">
                    <a dangerouslySetInnerHTML={{__html: post.html}}></a>
                </div>
                }
            </div>
            }
            {this.props.loggedIn &&
                <div className="card-body px-4 pt-2 pb-0 border-top">
                    <CommentEntry id={post._id} position={[]} onPost={this.onPost}>
                        <h6 className="comment-button mb-2 text-muted clickable">Add Comment</h6>
                    </CommentEntry>
                </div>
            }
            {post.comments.length > 0 &&
            <div className="card-body px-4 pt-2 pb-0 border-top">
                <CommentsSection 
                    ref={this.childElement} 
                    id={post._id} 
                    comments={post.comments} 
                    position={[]} 
                    userid={this.props.userid} 
                    loggedIn={this.props.loggedIn} 
                    submitEdit={this.submitEdit}/>
            </div>
            }
        </div>
    );
  }
}

export default BlogPost