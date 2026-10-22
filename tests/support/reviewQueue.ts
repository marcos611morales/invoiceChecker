import { screen, waitFor, within } from "@testing-library/react";

/** Accessible name that every card gives its editable proposed name (UI-SPEC line 256). */
export const NAME_INPUT_LABEL = "Nombre del producto sugerido";

/** Every proposed-name Input of the page, in card order. */
export function nameInputs(): HTMLInputElement[] {
  return screen
    .queryAllByRole("textbox", { name: NAME_INPUT_LABEL })
    .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement);
}

/** The proposed-name Input whose current value is `name`; throws when there is none. */
export function nameInput(name: string): HTMLInputElement {
  const found = nameInputs().find((input) => input.value === name);
  if (found === undefined) {
    throw new Error(`no card has the proposed name «${name}»`);
  }
  return found;
}

/** Waits for a card with this proposed name to appear and returns its Input. */
export async function findNameInput(name: string): Promise<HTMLInputElement> {
  await waitFor(() => {
    nameInput(name);
  });
  return nameInput(name);
}

/** The list item (card) that holds this Input. */
export function cardOf(input: HTMLElement): HTMLElement {
  const card = input.closest("li");
  if (card === null) throw new Error("the Input is not inside a card");
  return card;
}

/**
 * The checkboxes that choose a member of a card («Elegir «…»»), inside `root` or the whole page.
 * The checkbox that selects a card for the bulk actions («Seleccionar la sugerencia «…»») is not one.
 */
export function memberCheckboxes(root: HTMLElement = document.body): HTMLElement[] {
  return within(root).queryAllByRole("checkbox", { name: /^Elegir «/ });
}
