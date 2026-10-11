describe("Shared editor block List view", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const row = (id) =>
    cy.get(`.block-list-view [data-outline-id="${id}"] > .theme-tree-row`);
  const action = (label) =>
    cy
      .get('[aria-label="Block actions"]:popover-open')
      .contains("button", new RegExp(`^${label}`))
      .click();
  const visitTheme = () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get(".block-list-view").should("be.visible");
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get(".theme-live-preview").should("be.visible");
  };
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
      body: { walkthroughVersion: 1, colorMode: "dark" },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "List view fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.draft || body.published;
        document.templates.home = {
          id: "list-body",
          type: "core/container",
          settings: {},
          children: [
            { id: "list-header", type: "theme/part-header", settings: {} },
            {
              id: "list-one",
              type: "core/container",
              settings: {},
              children: [
                {
                  id: "list-title",
                  type: "core/heading",
                  settings: { text: "List title", level: 2 },
                },
                {
                  id: "list-copy",
                  type: "core/rich-text",
                  settings: { html: "<p>List paragraph</p>" },
                },
              ],
            },
            {
              id: "list-two",
              type: "core/container",
              settings: {},
              children: [
                {
                  id: "list-second",
                  type: "core/heading",
                  settings: { text: "Second section", level: 2 },
                },
              ],
            },
            { id: "list-footer", type: "theme/part-footer", settings: {} },
          ],
        };
        cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });

  it("opens List by default, shares context actions and selection with Outline, and saves the changes", () => {
    visitTheme();
    cy.get(".editor-panel-selector").should("contain", "List view");
    cy.get(".editor-panel-selector").click();
    cy.get('[aria-label="Sidebar panels"]:popover-open')
      .contains("button", "List view")
      .click();
    row("list-title").find(".theme-node-label").click();
    row("list-title").should("have.attr", "aria-selected", "true");
    cy.get(".contextual-block-toolbar").should("be.visible");
    row("list-title").rightclick();
    action("Duplicate");
    cy.get(
      '.block-list-view [data-outline-id="list-one"] [data-block-type="core/heading"]',
    )
      .should("have.length", 2)
      .last()
      .find(".theme-tree-row")
      .rightclick();
    action("Cut");
    cy.get(
      '.block-list-view [data-outline-id="list-one"] [data-block-type="core/heading"]',
    ).should("have.length", 1);
    row("list-copy").rightclick();
    action("Paste after");
    cy.get(
      '.block-list-view [data-outline-id="list-one"] [data-block-type="core/heading"]',
    ).should("have.length", 2);
    row("list-title").rightclick();
    action("Copy");
    row("list-two").rightclick();
    action("Paste inside");
    cy.get(
      '.block-list-view [data-outline-id="list-two"] [data-block-type="core/heading"]',
    ).should("have.length", 2);
    row("list-title").rightclick();
    action("Rename label");
    cy.get('[aria-label="Block label"]').clear().type("Featured title{enter}");
    row("list-title").should("contain", "Featured title");
    control("Outline").click();
    cy.get(".outline-surface").should("not.have.class", "block-list-view");
    cy.get('[data-outline-id="list-title"] > .theme-tree-row')
      .should("have.attr", "aria-selected", "true")
      .and("contain", "Featured title");
    control("List view").click();
    row("list-title").should("have.attr", "aria-selected", "true");
    row("list-title").trigger("keydown", { key: "ArrowDown" });
    cy.focused()
      .should("have.class", "theme-tree-row")
      .parent()
      .should("have.attr", "data-outline-id", "list-copy");
    control("Save draft").click();
    cy.get(".editor-sidebar-footer").should("contain", "Draft saved");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const children = body.draft.templates.home.children;
      expect(children[1].children).to.have.length(3);
      expect(children[2].children).to.have.length(2);
      expect(children[1].children[0].editor.label).eq("Featured title");
    });
    cy.reload();
    cy.get(".block-list-view")
      .should("be.visible")
      .and("contain", "Featured title");
    control("List view").should("have.attr", "aria-pressed", "true");
  });

  it("drags nested blocks and shared parts through stable List targets", () => {
    visitTheme();
    const drag = (sourceId, selector, pointerId) => {
      cy.get(selector)
        .scrollIntoView()
        .then((target) => {
          const doc = target[0].ownerDocument;
          const source = doc.querySelector(
            `[data-outline-id="${sourceId}"] > .theme-tree-row`,
          );
          const start = source.getBoundingClientRect();
          const rect = target[0].getBoundingClientRect();
          source.dispatchEvent(
            new doc.defaultView.PointerEvent("pointerdown", {
              bubbles: true,
              cancelable: true,
              pointerId,
              pointerType: "mouse",
              button: 0,
              buttons: 1,
              clientX: start.left + 8,
              clientY: start.top + 8,
            }),
          );
          for (const name of ["pointermove", "pointerup"]) {
            doc.dispatchEvent(
              new doc.defaultView.PointerEvent(name, {
                bubbles: true,
                cancelable: true,
                pointerId,
                pointerType: "mouse",
                button: 0,
                buttons: name === "pointerup" ? 0 : 1,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
              }),
            );
            if (name === "pointermove") {
              expect(target[0].classList.contains("over")).eq(true);
              expect(target[0].getBoundingClientRect().height).eq(rect.height);
            }
          }
        });
      cy.get(".theme-editor-viewport").should("not.have.class", "is-dragging");
    };
    drag(
      "list-title",
      '.block-list-view [data-outline-id="list-two"] > .theme-tree-row',
      71,
    );
    cy.get(
      '.block-list-view [data-outline-id="list-two"] [data-outline-id="list-title"]',
    ).should("exist");
    drag(
      "list-footer",
      '.block-list-view .theme-drop-zone[data-drop-parent="list-body"][data-drop-index="0"]',
      72,
    );
    cy.get(
      ".block-list-view .outline-tree > cl-theme-block-tree > cl-theme-block-tree",
    )
      .first()
      .children(".theme-tree-node")
      .should("have.attr", "data-outline-id", "list-footer");
    control("Save draft").click();
    cy.get(".editor-sidebar-footer").should("contain", "Draft saved");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const children = body.draft.templates.home.children;
      expect(children[0].id).eq("list-footer");
      expect(
        children.find((b) => b.id === "list-two").children.map((b) => b.id),
      ).deep.eq(["list-second", "list-title"]);
    });
  });

  for (const kind of ["post", "page"])
    it(`opens ${kind}s in List view and provides the same clipboard menu`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`List view ${kind}`);
      control("List view").should("have.attr", "aria-pressed", "true");
      cy.get(".block-list-view")
        .should("be.visible")
        .and("contain", "Main settings");
      cy.get(
        '.block-list-view [data-block-type="core/paragraph"] > .theme-tree-row',
      )
        .first()
        .rightclick();
      action("Duplicate");
      cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
        "have.length",
        2,
      );
      cy.get(
        '.block-list-view [data-block-type="core/paragraph"] > .theme-tree-row',
      )
        .last()
        .rightclick();
      action("Delete block");
      cy.get('.block-list-view [data-block-type="core/paragraph"]').should(
        "have.length",
        1,
      );
      control("Outline").click();
      cy.get('.outline-surface [data-block-type="core/paragraph"]').should(
        "have.length",
        1,
      );
      cy.get(".content-live-preview").should("be.visible");
    });
});
