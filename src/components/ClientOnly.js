import React, { Fragment, useEffect, useState } from 'react';

function ClientOnly(props) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient && <Fragment {...props} />;
}

export default ClientOnly;
