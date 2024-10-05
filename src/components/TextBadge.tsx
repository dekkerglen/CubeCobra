import React, { ReactNode } from 'react';
import { InputGroup, InputGroupText } from 'reactstrap';

interface TextBadgeProps {
  name?: string;
  className?: string;
  children: ReactNode;
  fill?: boolean;
}

const TextBadge: React.FC<TextBadgeProps> = ({ name = 'textBadge', className, children, fill = false }) => (
  <InputGroup size="sm" className={className ? `w-auto ${className}` : 'w-auto'}>
    <InputGroupText className={fill ? `w-50` : ''}>{name}</InputGroupText>
    <InputGroupText className={`${fill ? 'w-50 ' : ''}bg-white`}>{children}</InputGroupText>
  </InputGroup>
);

export default TextBadge;
