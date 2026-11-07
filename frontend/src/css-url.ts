/** A CSS `url("...")` for any address: quoted, with the characters that could end the string or the declaration escaped (#384). */
export function cssUrl(address: string): string {
  return `url("${address.replace(/[\\"\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}")`;
}
