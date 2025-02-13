// Returns any input into a properly capitalized resource name ("HELLO WORLD" -> HelloWorld)
export function toResourceName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}
