/** Read the rendered parent so responsive flex/grid layouts get the right arrows. */
export function toolbarMovement(block: HTMLElement) {
  const parent = block.parentElement;
  const style =
    parent && parent.ownerDocument.defaultView?.getComputedStyle(parent);
  if (!style) return { horizontal: false, reversed: false };
  if (style.display.includes("flex")) {
    const horizontal = !style.flexDirection.startsWith("column");
    return {
      horizontal,
      reversed:
        style.flexDirection.endsWith("reverse") !==
        (horizontal && style.direction === "rtl"),
    };
  }
  if (style.display.includes("grid")) {
    const horizontal =
      !style.gridAutoFlow.startsWith("column") &&
      style.gridTemplateColumns.split(/\s+/).length > 1;
    return { horizontal, reversed: horizontal && style.direction === "rtl" };
  }
  return { horizontal: false, reversed: false };
}
