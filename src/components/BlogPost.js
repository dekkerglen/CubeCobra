import React from 'react';
import { ListGroupItem, Collapse } from 'reactstrap';
import BlogContextMenu from './BlogContextMenu';

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
        <div className="card shadowed rounded-0 mt-3">
            <div className="card-header p-3">
                <h5 className="card-title">{post.title}<div class="float-sm-right">
                    {this.props.canEdit &&             
                    <BlogContextMenu className="float-sm-right" post={post} value='...'/>
                    }
                </div></h5>
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
        </div>
    );
  }
}

export default BlogPost