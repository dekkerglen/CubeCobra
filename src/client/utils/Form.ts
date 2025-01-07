import { fromEntries } from './Util';

interface FormElement extends HTMLFormElement {
  querySelectorAll(selectors: string): NodeListOf<HTMLInputElement>;
}

export const formDataObject = (formElement: FormElement): Record<string, string | boolean> => {
  const inputs = Array.from(formElement.querySelectorAll('[name]'));
  return fromEntries(inputs.map((input) => [input.name, input.type === 'checkbox' ? input.checked : input.value]));
};

export default { formDataObject };
