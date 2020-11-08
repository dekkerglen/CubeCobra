import React from 'react';
import TimeAgo from 'react-timeago';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';
import BlogContextMenu from './BlogContextMenu';
import CommentsSection from 'components/CommentsSection';
import Markdown from 'components/Markdown';

class BlogPost extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      childExpanded: props.focused ? true : false,
    };

    this.onPost = this.onPost.bind(this);
    this.submitEdit = this.submitEdit.bind(this);
    this.toggleChildCollapse = this.toggleChildCollapse.bind(this);
  }

  error(message) {
    console.log(message);
  }

  onPost(comment) {
    comment.index = this.props.post.comments.length;
    this.props.post.comments.push(comment);
    this.setState({
      childExpanded: true,
    });
  }

  saveEdit(comments, position, comment) {
    if (position.length == 1) {
      comments[position[0]] = comment;
    } else if (position.length > 1) {
      this.saveEdit(comments[position[0]].comments, position.slice(1), comment);
    }
  }

  toggleChildCollapse() {
    this.setState({
      childExpanded: !this.state.childExpanded,
    });
  }

  async submitEdit(comment, position) {
    //update current state
    this.saveEdit(this.props.post.comments, position, comment);
  }

  componentDidMount() {
    // FIXME: Restore scrolling to highlighted comment.
  }

  render() {
    const { post, onEdit } = this.props;
    if (post.html == 'undefined') {
      post.html = null;
    }
    return (
      <Card className="shadowed rounded-0 mb-3">
        <CardHeader className="pl-4 pr-0 pt-2 pb-0">
          <h5 className="card-title">
            {post.title}
            <div className="float-sm-right">
              {this.props.canEdit && (
                <BlogContextMenu className="float-sm-right" post={post} value="..." onEdit={onEdit} />
              )}
            </div>
          </h5>
          <h6 className="card-subtitle mb-2 text-muted">
            <a href={'/user/view/' + post.owner}>{post.dev == 'true' ? 'Dekkaru' : post.username}</a>
            {' posted to '}
            {post.dev == 'true' ? (
              <a href={'/dev/blog/0'}>Developer Blog</a>
            ) : (
              <a href={'/cube/overview/' + post.cube}>{post.cubename}</a>
            )}
            {' - '}
            <TimeAgo date={post.date} />
          </h6>
        </CardHeader>
        <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
          {post.changelist && (post.html || post.markdown) ? (
            <Row className="no-gutters">
              <Col className="col-12 col-l-5 col-md-4 col-sm-12 blog-post-border">
                <CardBody className="py-2">
                  <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />
                </CardBody>
              </Col>
              <Col className="col-l-7 col-m-6">
                <CardBody className="py-2">
                  {post.markdown ? (
                    <Markdown markdown={post.markdown} />
                  ) : (
                    <CardText dangerouslySetInnerHTML={{ __html: post.html }} />
                  )}
                </CardBody>
              </Col>
            </Row>
          ) : (
            <CardBody className="py-2">
              {post.changelist && <CardText dangerouslySetInnerHTML={{ __html: post.changelist }} />}
              {post.body && <CardText>{post.body}</CardText>}
              {(post.html || post.markdown) &&
                (post.markdown ? (
                  <Markdown markdown={post.markdown} limited />
                ) : (
                  <CardText dangerouslySetInnerHTML={{ __html: post.html }} />
                ))}
            </CardBody>
          )}
        </div>
        <div className="border-top">
          <CommentsSection parentType="blog" parent={post._id} userid={this.props.userid} collapse={false} />
        </div>
      </Card>
    );
  }
}

export default BlogPost;
