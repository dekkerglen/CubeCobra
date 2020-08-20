import { useEffect, useState } from 'react';
import { csrfFetch } from 'utils/CSRF';

const useToggle = (type, parent) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const addComment = async (comment) => {
    const response = await csrfFetch(`/comment/${type}/${parent}`, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment,
      }),
    });
    const val = await response.json(); // parses JSON response into native JavaScript objects

    const clone = JSON.parse(JSON.stringify(comments));
    clone.push(val.comment);
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
      const val = await response.json(); // parses JSON response into native JavaScript objects
      return val;
    };

    getData().then((result) => {
      setComments(result.comments);
      setLoading(false);
    });
  }, [parent, type]);

  return [comments, addComment, loading];
};

export default useToggle;
