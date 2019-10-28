import React from 'react';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';
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
        <Card className="shadowed rounded-0 mt-3">
            <CardHeader className="pl-4 pr-0 pt-2 pb-0">
                <h5 className="card-title">{post.title}<div className="float-sm-right">
                    {this.props.canEdit &&             
                    <BlogContextMenu className="float-sm-right" post={post} value='...'/>
                    }
                </div></h5>
                <h6 className="card-subtitle mb-2 text-muted">{post.date_formatted}</h6>                  
            </CardHeader>
            {(post.changelist && post.html) ? 
            <Row className="no-gutters">
                <Col className="col-12 col-l-3 col-md-3 col-sm-12" style={{'borderRight': '1px solid #DFDFDF'}}>
                    <CardBody className="py-2">
                        <CardText dangerouslySetInnerHTML={{__html: post.changelist}} />
                    </CardBody>
                </Col>                     
                <Col className="col-9">
                    <CardBody className="py-2">
                        <CardText dangerouslySetInnerHTML={{__html: post.html}}/>
                    </CardBody>
                </Col>
            </Row>
            : 
            <CardBody className="py-2">
                {post.changelist &&
                    <CardText dangerouslySetInnerHTML={{__html: post.changelist}} />
                }
                {post.body &&
                    <CardText>{post.body}</CardText>
                }
                {post.html &&
                    <CardText dangerouslySetInnerHTML={{__html: post.html}}/>
                }
            </CardBody>
            }
            {this.props.loggedIn &&
                <CardBody className="px-4 pt-2 pb-0 border-top">
                    <CommentEntry id={post._id} position={[]} onPost={this.onPost}>
                        <h6 className="comment-button mb-2 text-muted clickable">Add Comment</h6>
                    </CommentEntry>
                </CardBody>
            }
            {post.comments.length > 0 &&
            <CardBody className=" px-4 pt-2 pb-0 border-top">
                <CommentsSection 
                    ref={this.childElement} 
                    id={post._id} 
                    comments={post.comments} 
                    position={[]} 
                    userid={this.props.userid} 
                    loggedIn={this.props.loggedIn} 
                    submitEdit={this.submitEdit}/>
            </CardBody>
            }
        </Card>
    );
  }
}

export default BlogPost