describe("V2.0.5 editor", () => {
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  const chooseTemplate = (id) => {
    control("Choose template").click();
    cy.get(
      `dialog[aria-label="Choose template"][open] [data-template-id="${id}"]`,
    ).click();
  };
  const headers = { Origin: "http://127.0.0.1:4201" };
  let id;
  beforeEach(() => {
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
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "V205 Editor Test" },
        }),
      )
      .then(({ body }) => {
        id = body.id;
        cy.visit("/admin/themes/edit/" + id, {
          onBeforeLoad(win) {
            win.sessionStorage.setItem("colossal.block-library.open", "false");
          },
        });
        cy.get(".theme-live-preview").should((frame) =>
          expect(frame[0].contentDocument.querySelector(".theme-root")).not.eq(
            null,
          ),
        );
      });
  });
  it("shows a contextual Heading toolbar whose changes reach the Inspector", () => {
    cy.get(".theme-live-preview")
      .its("0.contentDocument.body")
      .find("[data-block-id] h1")
      .first()
      .click();
    cy.get('[role="toolbar"][aria-label="Block tools for Heading"]')
      .should("be.visible")
      .within(() => {
        cy.get('[aria-label="Bold"]')
          .click()
          .should("have.attr", "aria-pressed", "true");
        cy.get('[aria-label="Italic"]').should("exist");
        cy.get('[aria-label="Underline"]').should("exist");
        cy.get('[aria-label="Heading level"]').should("exist");
      });
    control("Save draft").click();
    cy.request("/api/themes/" + id).then(({ body }) => {
      const nodes = [];
      const visit = (n) => {
        nodes.push(n);
        (n.children || []).forEach(visit);
      };
      visit(body.draft.templates.home);
      expect(
        nodes.some(
          (n) => n.type === "core/heading" && n.settings.bold === true,
        ),
      ).eq(true);
    });
  });
  it("creates two Columns and wraps a dropped Heading in another Column", () => {
    control("Blocks").click();
    for (const type of ["core/row", "core/group", "core/content", "core/gltf"])
      cy.get('[data-library-block="' + type + '"]').should("exist");
    cy.get('[data-library-block="core/column"]').should("be.disabled");
    cy.get('[data-library-block="core/columns"]').click();
    cy.contains("Columns accepts Column blocks only.").should("be.visible");
    cy.get('[data-library-block="core/column"]').should("not.be.disabled");
    cy.get('[data-library-block="core/heading"]').click();
    cy.contains("Wrapped in a Column.").should("exist");
    control("Save draft").click();
    cy.request("/api/themes/" + id).then(({ body }) => {
      const columns = body.draft.templates.home.children.find(
        (n) => n.type === "core/columns",
      );
      expect(columns.children).to.have.length(3);
      expect(columns.children.every((n) => n.type === "core/column")).eq(true);
      expect(columns.children[2].children[0].type).eq("core/heading");
    });
  });
});

describe("V2.0.5 pages list", () => {
  it("keeps pages visible and filters by author while Quick Edit preserves the body", () => {
    const headers = { Origin: "http://127.0.0.1:4201" };
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request({
      method: "POST",
      url: "/api/admin/content",
      headers,
      body: {
        kind: "page",
        title: "V205 page",
        slug: "v205-page",
        excerpt: "",
        body: "Keep this body",
        status: "published",
        details: {},
      },
    }).then(({ body }) => {
      const id = body.id;
      cy.visit("/admin/pages");
      cy.contains("V205 page").should("be.visible");
      cy.get('[aria-label="Filter by author"]').should("exist").select(1);
      cy.contains("V205 page").should("be.visible");
      cy.contains("button", "Quick Edit").click();
      cy.get('[role="dialog"][aria-labelledby="quick-title"]').within(() => {
        cy.get('input[name="title"]').clear().type("V205 renamed page");
        cy.contains("button", "Save").click();
      });
      cy.contains("V205 renamed page").should("be.visible");
      cy.request("/api/admin/state").then(({ body: state }) => {
        const page = state.content.find((c) => c.id === id);
        expect(page.title).eq("V205 renamed page");
        expect(page.body).eq("Keep this body");
      });
    });
  });
});

describe("404 page routing", () => {
  it("shows the assigned page on missing URLs without adding it to navigation", () => {
    const headers = { Origin: "http://127.0.0.1:4201" };
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request("/api/themes/com.colossal.theme.default").then(({ body }) =>
      cy.request({
        method: "POST",
        url: "/api/themes/com.colossal.theme.default/activate",
        headers,
        body: { revision: body.revision },
      }),
    );
    cy.request({
      method: "POST",
      url: "/api/admin/content",
      headers,
      body: {
        kind: "page",
        title: "Lost page",
        slug: "lost-page",
        body: "Custom missing page body",
        excerpt: "",
        status: "published",
        details: {},
      },
    }).then(({ body: page }) => {
      cy.request("/api/admin/state").then(({ body: state }) => {
        cy.request({
          method: "POST",
          url: "/api/admin/settings",
          headers,
          body: {
            ...state.settings,
            routingVersion: 2,
            notFoundPageId: page.id,
          },
        });
      });
    });
    cy.visit("/a-page-that-does-not-exist", { failOnStatusCode: false });
    cy.get(".theme-root")
      .should("contain.text", "Lost page")
      .and("contain.text", "Custom missing page body");
    cy.get(".theme-menu").should("not.contain.text", "Lost page");
    cy.get('.theme-menu a[href="/lost-page"]').should("not.exist");
  });
});
