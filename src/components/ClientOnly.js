import React, { Fragment, useEffect, useState } from 'react';

const ClientOnly = (props) => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient && <Fragment {...props} />;
};

export default ClientOnly;
