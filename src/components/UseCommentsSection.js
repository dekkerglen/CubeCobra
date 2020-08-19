import React from 'react';

import { Collapse } from 'reactstrap';

import PagedList from 'components/PagedList';

const UseCommentsSection = (Comment) => ({
  comments,
  id,
  focused,
  userid,
  loggedIn,
  submitEdit,
  submitUrl,
  insertReply,
  expanded,
  position,
}) => {
  return (
    comments.length > 0 && (
      <Collapse isOpen={expanded}>
        <PagedList
          pageSize={10}
          rows={comments
            .slice(0)
            .reverse()
            .map((comment) => (
              <Comment
                key={comment.index}
                id={id}
                focused={focused && focused[0] === comment.index ? focused.slice(1) : null}
                position={position.concat([comment.index])}
                comment={comment}
                userid={userid}
                loggedIn={loggedIn}
                submitEdit={submitEdit}
                submitUrl={submitUrl}
                insertReply={insertReply}
              />
            ))}
        />
      </Collapse>
    )
  );
};

export default UseCommentsSection;
