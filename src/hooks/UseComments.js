import { useCallback, useEffect, useState } from 'react';
import { csrfFetch } from 'utils/CSRF';
import { findUserLinks } from 'markdown/parser';
import { wait } from 'utils/Util';

const useToggle = (parent, type) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastKey, setLastKey] = useState(null);

  const addComment = useCallback(
    async (comment) => {
      const mentions = findUserLinks(comment).join(';');
      const response = await csrfFetch(`/comment/addcomment`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: comment,
          mentions,
          parent,
          type,
        }),
      });
      const val = await response.json();
      setComments([val.comment, ...comments]);
    },
    [comments, parent, type],
  );

  const editComment = useCallback(
    async (comment) => {
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
        if (clone[i].Id === comment.id) {
          if (comment.remove) {
            clone[i].Body = '[deleted]';
            clone[i].User = {
              Id: '404',
              Username: 'Anonymous',
            };
            clone[i].ImageData = {
              uri: 'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/e/0e386888-57f5-4eb6-88e8-5679bb8eb290.jpg?1608910517',
              artist: 'Allan Pollack',
              id: '0c082aa8-bf7f-47f2-baf8-43ad253fd7d7',
            };
          } else {
            clone[i].Body = comment.content;
          }
        }
      }

      setComments(clone);
    },
    [comments],
  );

  useEffect(() => {
    const getData = async () => {
      const response = await csrfFetch(`/comment/getcomments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent,
        }),
      });
      const result = await response.json();
      setComments(result.comments);
      setLastKey(result.lastKey);
      setLoading(false);
    };

    getData();
  }, [parent]);

  const getMore = useCallback(async () => {
    setLoading(true);
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/comment/getcomments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent,
        lastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setComments([...comments, ...json.comments]);
        setLastKey(json.lastKey);
        setLoading(false);
      }
    }
  }, [parent, lastKey, comments]);

  return [comments, addComment, loading, editComment, lastKey, getMore];
};

export default useToggle;
