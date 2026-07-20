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
