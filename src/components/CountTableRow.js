import React from 'react';

const CountTableRow = ({label, value, ...props }) => (
    <tr>
        <td>{label}:</td>
        <td>
            {Math.round(value[1] * 1000.0)/10}%                              
            <span className="percent">{value[0]}</span>
        </td>
    </tr>
);

export default CountTableRow;
