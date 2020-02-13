import { fromEntries } from 'utils/Util';

export const formDataObject = (formElement) => {
  const inputs = [...formElement.querySelectorAll('[name]')];
  return fromEntries(inputs.map((input) => [input.name, input.type === 'checkbox' ? input.checked : input.value]));
};

export default { formDataObject };
