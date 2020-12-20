import { useEffect, useState } from 'react';
import { csrfFetch } from 'utils/CSRF';
import { findUserLinks } from 'markdown/parser';

const useToggle = (type, parent) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const addComment = async (comment) => {
    const mentions = findUserLinks(comment);
    const response = await csrfFetch(`/comment/${type}/${parent}`, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment,
        mentions,
      }),
    });
    const val = await response.json();

    const clone = JSON.parse(JSON.stringify(comments));
    clone.push(val.comment);
    setComments(clone);
  };

  const editComment = async (comment) => {
    await csrfFetch(`/comment/edit`, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment,
      }),
    });

    const clone = JSON.parse(JSON.stringify(comments));

    for (let i = 0; i < clone.length; i++) {
      if (clone[i]._id === comment._id) {
        clone[i] = comment;
      }
    }

    setComments(clone);
  };

  useEffect(() => {
    const getData = async () => {
      // Default options are marked with *
      const response = await csrfFetch(`/comment/${type}/${parent}`, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        headers: {
          'Content-Type': 'application/json',
          // 'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const val = await response.json();
      return val;
    };

    getData().then((result) => {
      setComments(result.comments);
      setLoading(false);
    });
  }, [parent, type]);

  return [comments, addComment, loading, editComment];
};

export default useToggle;
