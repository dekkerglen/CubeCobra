import PropTypes from 'prop-types';

import { Input, InputGroup, InputGroupAddon, InputGroupText } from 'reactstrap';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} {...props} />
  </InputGroup>
);

TextField.propTypes = {
  name: PropTypes.string.isRequired,
  humanName: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TextField;
