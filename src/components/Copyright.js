import React from 'react';

function Copyright() {
  const currentDate = new Date().getFullYear();

  return <>All other content Copyright © 2019-{currentDate} Cube Cobra</>;
}

export default Copyright;
