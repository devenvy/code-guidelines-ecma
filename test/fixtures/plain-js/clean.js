/** @param {string} name */
export function greet(name) {
  const element = document.createElement('p');
  element.textContent = `Hello ${name}`;
  return element;
}
