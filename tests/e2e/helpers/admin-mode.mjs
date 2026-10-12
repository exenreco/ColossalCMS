export function setAdminMode(adminColorMode) {
  cy.request({
    method: "POST",
    url: "/api/admin/settings",
    headers: { Origin: "http://127.0.0.1:4201" },
    body: { adminColorMode },
  });
  cy.window().then((win) => win.dispatchEvent(new win.Event("focus")));
  cy.get(".shared-editor").should(
    "have.attr",
    "data-color-mode",
    adminColorMode,
  );
}
