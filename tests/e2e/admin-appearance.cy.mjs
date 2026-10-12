describe("Admin appearance settings", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1 },
    });
  });
  const save = (mode) => {
    cy.contains("button", "Appearance").click();
    cy.get('select[name="adminColorMode"]').select(mode);
    cy.intercept("POST", "/api/admin/settings").as("appearance");
    cy.contains("button", "Save changes").click();
    cy.wait("@appearance").its("response.statusCode").should("equal", 200);
  };
  it("persists appearance and applies it to the dashboard and shared editors without mode toggles", () => {
    cy.visit("/admin/settings");
    save("dark");
    cy.get("html").should("have.attr", "data-admin-mode", "dark");
    cy.get('input[name="logo"],input[name="accent"]').should("not.exist");
    cy.get(".topbar").should("have.css", "background-color", "rgb(10, 10, 10)");
    cy.get('select[name="adminColorMode"]').should(
      "have.css",
      "background-color",
      "rgb(14, 14, 14)",
    );
    cy.screenshot("admin-dark-appearance");
    cy.reload();
    cy.contains("button", "Appearance").click();
    cy.get('select[name="adminColorMode"]').should("have.value", "dark");
    cy.visit("/admin/themes/edit/com.colossal.theme.default");
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "dark");
    cy.get(".editor-mode-toggle").should("not.exist");
    cy.visit("/admin/pages/edit/about");
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "dark");
    cy.get(".editor-mode-toggle").should("not.exist");
    cy.visit("/admin/settings");
    save("light");
    cy.get("html").should("have.attr", "data-admin-mode", "light");
    cy.visit("/admin/themes/edit/com.colossal.theme.default");
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "light");
  });
  it("System follows device color-scheme changes live", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "system" },
    });
    let device;
    cy.visit("/admin/themes/edit/com.colossal.theme.default", {
      onBeforeLoad(win) {
        const original = win.matchMedia.bind(win);
        device = new win.EventTarget();
        device.matches = false;
        win.matchMedia = (query) =>
          query === "(prefers-color-scheme: dark)" ? device : original(query);
      },
    });
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "light");
    cy.window().then((win) => {
      device.matches = true;
      const event = new win.Event("change");
      Object.defineProperty(event, "matches", { value: true });
      device.dispatchEvent(event);
    });
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "dark");
    cy.get("html").should("have.attr", "data-admin-mode", "dark");
  });
  it("keeps icons and labels in one navigation list and closes the mobile menu after navigation", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "dark" },
    });
    cy.visit("/admin/dashboard");
    cy.get('.sidebar nav a[aria-label="Pages"]').click();
    cy.location("pathname").should("equal", "/admin/pages");
    cy.get(".sidebar nav a.active").should("have.attr", "aria-current", "page");
    cy.get('.sidebar nav a[aria-label="Pages"] > span').should("be.visible");
    cy.get('button[aria-label="Collapse navigation"]').click();
    cy.get('.sidebar nav a[aria-label="Pages"] > span').should(
      "not.be.visible",
    );
    cy.get(".admin-navigation-panel").should(($panel) => {
      expect($panel[0].scrollWidth).to.be.at.most($panel[0].clientWidth);
    });
    cy.screenshot("admin-compact-navigation");
    cy.get('button[aria-label="Expand navigation"]').click();
    cy.get('.sidebar nav a[aria-label="Pages"] > span').should("be.visible");
    cy.get('.sidebar nav a[aria-label="Pages"] > cl-icon').should("be.visible");
    cy.get('.sidebar nav a[aria-label="Pages"]').should("have.length", 1);
    cy.get(".sidebar").should("have.css", "width", "240px");
    cy.screenshot("admin-expanded-navigation");
    cy.get('.sidebar nav a[aria-label="Media"]')
      .should(($link) => {
        expect(getComputedStyle($link[0], "::before").display).to.equal(
          "block",
        );
        expect(getComputedStyle($link[0], "::before").opacity).to.equal("0.3");
      })
      .focus()
      .should(($link) => {
        expect(getComputedStyle($link[0], "::before").opacity).to.equal("1");
      });
    cy.location("pathname").should("equal", "/admin/pages");
    cy.screenshot("admin-navigation-tree");
    cy.get('.sidebar nav a[aria-label="Media"]')
      .blur()
      .should(($link) => {
        expect(getComputedStyle($link[0], "::before").display).to.equal(
          "block",
        );
        expect(getComputedStyle($link[0], "::before").opacity).to.equal("0.3");
      });
    cy.get('button[aria-label="Collapse navigation"]').click();
    cy.viewport(390, 844);
    cy.get(".sidebar").should("not.have.class", "mobile-open");
    cy.get('button[aria-label="Open navigation"]').click();
    cy.get(".sidebar").should("have.class", "mobile-open");
    cy.get('.sidebar nav a[aria-label="Posts"]').click();
    cy.location("pathname").should("equal", "/admin/posts");
    cy.get(".sidebar").should("not.have.class", "mobile-open");
    cy.get(".main-shell").should("have.css", "margin-left", "0px");
    cy.screenshot("admin-mobile-navigation");
  });
});
