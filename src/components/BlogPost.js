import React from 'react';
import { ListGroupItem, Collapse } from 'reactstrap';

class BlogPost extends React.Component {
  constructor(props) {
    super(props);
    
    this.toggle = this.toggle.bind(this);
    this.state = {collapse: false};
  }
  
  toggle() {
    this.setState({ collapse: !this.state.collapse });
  }
  
  render() {
    var post = this.props.post;
    return (
        <div className="card mt-3">
            <div className="card-header">
            <h5 className="card-title">{post.title}</h5>
            <h6 className="card-subtitle mb-2 text-muted">{post.date_formatted}</h6>
            </div>
            {(post.changelist && post.html) ? 
            <div className="row no-gutters">
                <div className="col col-12 col-l-3 col-md-3 col-sm-12" style={{'borderRight': '1px solid #DFDFDF'}}>
                <div className="card-body">
                    <p className="card-text">
                    <a dangerouslySetInnerHTML={{__html: post.changelist}}></a>
                    </p>
                </div>
                </div>                     
                <div className="col col-9">
                <div className="card-body">
                    <div className="card-text">
                    <a dangerouslySetInnerHTML={{__html: post.html}}></a>
                    </div>
                </div>
                </div>
            </div>
            : 
            <div className="card-body">
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
            {this.props.canEdit &&
            <div className="card-footer">
                <span>
                <button className="btn btn-success mr-2 editBlogButton" role='button' data-id={post._id}>Edit</button>
                <a> </a>
                <button className="btn btn-danger  mr-2" role='button' onClick={this.toggle}>Delete</button>
                </span>
                 <Collapse isOpen={this.state.collapse}>
                    <span>
                        <a>Are you sure? This action cannot be undone.</a>
                        <button className="btn btn-danger delete-blog" type='submit' value='Delete' data-id={post._id}>Yes, delete this post</button>
                    </span>
              </Collapse>
            </div>
            }
        </div>
    );
  }
}

export default BlogPost