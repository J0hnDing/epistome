export function renderInlineDescription({ document, container, description, terms, onTermClick }) {
  const termsById = new Map(terms.map((term) => [term.id, term]));
  container.replaceChildren();

  for (const part of description) {
    if (part.type === "text") {
      container.append(document.createTextNode(part.text));
      continue;
    }

    const term = termsById.get(part.termId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-term";
    button.textContent = term.label;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "termPopover");
    button.addEventListener("click", () => onTermClick(button, term));
    container.append(button);
  }
}

export function renderTermList({ document, container, terms }) {
  container.replaceChildren();

  for (const term of terms) {
    const item = document.createElement("div");
    item.className = "term-list-item";

    const label = document.createElement("dt");
    label.textContent = term.label;
    const definition = document.createElement("dd");
    definition.textContent = term.definition;

    item.append(label, definition);
    container.append(item);
  }
}
