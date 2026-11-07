/** Enter and Space on a card or card head work its click (#180); a key pressed on a control inside it is left alone. */
export function activateKey(act: () => void): (ev: KeyboardEvent) => void {
  return (ev) => {
    if (ev.target !== ev.currentTarget || (ev.key !== "Enter" && ev.key !== " ")) return;
    ev.preventDefault();
    act();
  };
}
