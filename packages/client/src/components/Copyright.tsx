import React from 'react';

// Resolved once at module load rather than per render: `new Date()` during render is impure,
// and the displayed year does not need to change within a session.
const CURRENT_YEAR = new Date().getFullYear();

const Copyright: React.FC = () => <>All other content Copyright © 2019-{CURRENT_YEAR} Cube Cobra</>;

export default Copyright;
