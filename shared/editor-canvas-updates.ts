/** Patch server-rendered markup without navigating the authoring iframe. */
export class EditorCanvasUpdates {
  private source = "";
  private previous?: Document;
  private document?: Document;
  private nodes = new WeakMap<Node, Node>();

  prepare(source: string) {
    this.source = source;
    this.document = undefined;
  }

  capture(document: Document) {
    if (!this.source || this.document === document) return;
    this.document = document;
    this.previous = new DOMParser().parseFromString(this.source, "text/html");
    this.nodes = new WeakMap();
    this.bind(this.previous.body, document.body);
  }

  private bind(source: Node, live: Node) {
    this.nodes.set(source, live);
    Array.from(source.childNodes).forEach((child, index) => {
      const target = live.childNodes[index];
      if (target) this.bind(child, target);
    });
  }

  update(frame: HTMLIFrameElement | undefined, source: string) {
    const document = frame?.contentDocument;
    if (!document || document !== this.document || !this.previous) return false;
    const next = new DOMParser().parseFromString(source, "text/html");
    const style = document.head.querySelector("style");
    const css = next.head.querySelector("style")?.textContent || "";
    if (style && style.textContent !== css) style.textContent = css;
    this.patch(this.previous.body, next.body);
    // Inline typing mutates the live DOM before a render. Undo can restore an
    // identical server snapshot, so compare authored text with the live content too.
    for (const paragraph of Array.from(
      document.querySelectorAll<HTMLElement>("[data-inline-text-editor]"),
    )) {
      const blockId = paragraph
        .closest("[data-block-id]")
        ?.getAttribute("data-block-id");
      const block = Array.from(next.querySelectorAll("[data-block-id]")).find(
        (element) => element.getAttribute("data-block-id") === blockId,
      );
      const rendered = block?.querySelector(
        ":scope > p,:scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6",
      );
      if (!rendered || paragraph.innerHTML === rendered.innerHTML) continue;
      paragraph.replaceChildren(
        ...Array.from(rendered.childNodes).map((child) =>
          document.importNode(child, true),
        ),
      );
      this.bind(rendered, paragraph);
    }
    this.previous = next;
    this.source = source;
    return true;
  }

  private patch(before: Node, after: Node): Node {
    let live = this.nodes.get(before)!;
    // Authoring widgets replace rendered HTML. Rebuild only when its content changes.
    if (!live?.isConnected) {
      live = this.document!.importNode(after, true);
      this.bind(after, live);
      return live;
    }
    this.nodes.set(after, live);
    if (before.nodeType !== 1) {
      if (before.nodeValue !== after.nodeValue)
        live.nodeValue = after.nodeValue;
      return live;
    }
    const oldElement = before as HTMLElement;
    const nextElement = after as HTMLElement;
    const element = live as HTMLElement;
    if (
      (element.dataset?.["modelMounted"] ||
        element.dataset?.["geometryMounted"] ||
        element.dataset?.["swiperMounted"]) &&
      [
        ...oldElement.getAttributeNames(),
        ...nextElement.getAttributeNames(),
      ].some(
        (name) =>
          name.startsWith("data-") &&
          oldElement.getAttribute(name) !== nextElement.getAttribute(name),
      )
    ) {
      const replacement = this.document!.importNode(after, true);
      live.parentNode!.replaceChild(replacement, live);
      this.bind(after, replacement);
      return replacement;
    }
    const names = new Set([
      ...oldElement.getAttributeNames(),
      ...nextElement.getAttributeNames(),
    ]);
    for (const name of names) {
      const oldValue = oldElement.getAttribute(name);
      const value = nextElement.getAttribute(name);
      if (oldValue === value) continue;
      if (name === "class") {
        for (const token of Array.from(oldElement.classList))
          if (!nextElement.classList.contains(token))
            element.classList.remove(token);
        for (const token of Array.from(nextElement.classList))
          element.classList.add(token);
      } else if (name === "style") {
        for (const property of Array.from(oldElement.style))
          if (!nextElement.style.getPropertyValue(property))
            element.style.removeProperty(property);
        for (const property of Array.from(nextElement.style))
          if (
            oldElement.style.getPropertyValue(property) !==
            nextElement.style.getPropertyValue(property)
          )
            element.style.setProperty(
              property,
              nextElement.style.getPropertyValue(property),
              nextElement.style.getPropertyPriority(property),
            );
      } else if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    const oldChildren = Array.from(before.childNodes);
    const newChildren = Array.from(after.childNodes);
    if (oldElement.innerHTML === nextElement.innerHTML) {
      oldChildren.forEach((child, index) =>
        this.transfer(child, newChildren[index]),
      );
      return live;
    }
    // A code editor or a runtime has replaced these children; retain its host.
    if (
      oldChildren.some((child) => this.nodes.get(child)?.parentNode !== live)
    ) {
      element.replaceChildren(
        ...newChildren.map((child) => {
          const copy = this.document!.importNode(child, true);
          this.bind(child, copy);
          return copy;
        }),
      );
      return live;
    }
    const remaining = new Set(oldChildren);
    const key = (node: Node) =>
      node.nodeType === 1
        ? (node as Element).getAttribute("data-block-id") ||
          (node as Element).id
        : "";
    let anchor: Node | null = oldChildren.length
      ? this.nodes.get(oldChildren[0])!
      : null;
    newChildren.forEach((child, index) => {
      const id = key(child);
      const match = id
        ? oldChildren.find(
            (old) =>
              remaining.has(old) &&
              key(old) === id &&
              old.nodeName === child.nodeName,
          )
        : oldChildren[index];
      let target: Node;
      if (
        match &&
        remaining.has(match) &&
        match.nodeName === child.nodeName &&
        !(!id && key(match))
      ) {
        remaining.delete(match);
        target = this.patch(match, child);
      } else {
        target = this.document!.importNode(child, true);
        this.bind(child, target);
      }
      if (anchor && anchor.parentNode !== live)
        anchor = target.parentNode === live ? target : null;
      if (target !== anchor) live.insertBefore(target, anchor);
      anchor = target.nextSibling;
    });
    for (const child of remaining)
      this.nodes.get(child)?.parentNode?.removeChild(this.nodes.get(child)!);
    return live;
  }

  private transfer(before: Node, after: Node) {
    const live = this.nodes.get(before);
    if (live) this.nodes.set(after, live);
    Array.from(before.childNodes).forEach((child, index) =>
      this.transfer(child, after.childNodes[index]),
    );
  }
}
