import React from 'react';

const CountTableRow = ({label, percent, value , ...props }) => (
    <tr>
        <td>{label}:</td>
        <td>
            {Math.round(percent * 1000.0)/10}%                              
            <span className="percent">{value}</span>
        </td>
    </tr>
);

export default CountTableRow;
