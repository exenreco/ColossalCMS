describe("v0.0.3 outline editor and theme API", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
  const row = (id) =>
    cy.get('.theme-outline [data-outline-id="' + id + '"] > .theme-tree-row');
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers: headers,
      body: { walkthroughVersion: 1 },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "Outline regression" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.published;
        document.templates.home = {
          id: "outline-root",
          type: "core/container",
          settings: {},
          children: [
            { id: "shared-header", type: "theme/part-header", settings: {} },
            {
              id: "group-a",
              type: "core/container",
              editor: { label: "Hero section" },
              settings: {},
              children: [
                {
                  id: "first-heading",
                  type: "core/heading",
                  settings: { text: "Make something meaningful", level: "h1" },
                },
              ],
            },
            {
              id: "group-b",
              type: "core/container",
              editor: { label: "Selected work" },
              settings: {},
              children: [
                {
                  id: "second-heading",
                  type: "core/heading",
                  settings: { text: "Existing project", level: "h2" },
                },
              ],
            },
            { id: "shared-footer", type: "theme/part-footer", settings: {} },
          ],
        };
        // Theme roots may reuse IDs across templates; API snapshots still follow
        // the active template even when its selection ID does not change.
        document.templates.default = structuredClone(document.templates.home);
        document.templates.default.children[1].editor.label = "Page hero";
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      })
      .then(() => {
        cy.visit("/admin/themes/edit/" + themeId, {
          onBeforeLoad(win) {
            win.sessionStorage.setItem("colossal.block-library.open", "false");
            win.sessionStorage.setItem("colossal.inspector.open", "false");
          },
        });
        cy.get('[aria-label="Outline"]').click();
        cy.get(".outline-surface").should("be.visible");
      });
  });
  it("keeps Body settings outside the tree and exposes root children without an extra nesting level", () => {
    cy.get(".theme-outline .outline-document-settings")
      .should("contain.text", "Body settings")
      .and("not.have.attr", "aria-expanded");
    cy.get(
      '.theme-outline .outline-tree [data-outline-id="outline-root"]',
    ).should("not.exist");
    cy.get('.theme-outline .outline-tree [aria-level="1"]').should(
      "have.length",
      4,
    );
    row("first-heading").should("have.attr", "aria-level", "2");
    cy.get(".theme-outline .outline-count").should("contain.text", "6 blocks");
    cy.get('.theme-outline [aria-label="Collapse all blocks"]').click();
    row("group-a").should("have.attr", "aria-expanded", "false");
    row("group-b").should("have.attr", "aria-expanded", "false");
    row("shared-header").should("be.visible");
    cy.get('.theme-outline [aria-label="Expand all blocks"]').click();
    row("first-heading").should("be.visible");
    cy.window().then((win) => {
      const api = win.colossalThemeEditor;
      expect(api.dispatch({ type: "collapse", id: "outline-root" })).eq(false);
      expect(api.dispatch({ type: "remove", id: "outline-root" })).eq(false);
      expect(api.getOutline().root.children).to.have.length(4);
    });
    row("shared-header").click().trigger("keydown", { key: "ArrowLeft" });
    cy.get(".theme-outline .outline-document-settings")
      .should("be.focused")
      .trigger("keydown", { key: "ArrowDown" });
    row("shared-header").should("be.focused");
    row("shared-header").trigger("keydown", { key: "ArrowUp" });
    cy.get(".theme-outline .outline-document-settings")
      .should("be.focused")
      .click();
    cy.get("#theme-inspector")
      .should("be.visible")
      .and("contain.text", "BODY SETTINGS");
    cy.get('button[aria-label="Outline"]').click();
    row("group-a").find(".outline-expand").click();
    row("group-a").should("have.attr", "aria-expanded", "false");
    row("group-b").should("be.visible");
    cy.get('.theme-outline [aria-label="Add top-level block"]').click();
    cy.get('[aria-label="Find a block to insert"]').type("Spacer");
    cy.get(".outline-insert-options").contains("button", "Spacer").click();
    cy.window().should((win) => {
      const snapshot = win.colossalThemeEditor.getOutline();
      expect(snapshot.root.id).eq("outline-root");
      expect(snapshot.root.children.at(-1).type).eq("core/spacer");
    });
    cy.get('.theme-outline .outline-tree [aria-level="1"]').should(
      "have.length",
      5,
    );
    cy.get(".theme-outline .outline-document-settings").click();
    cy.get("#theme-inspector").should("contain.text", "BODY SETTINGS");
    cy.window().should((win) =>
      expect(win.colossalThemeEditor.getOutline().selectedId).eq(
        "outline-root",
      ),
    );
  });
  it("offers shared-part settings and a root drop target when the part is empty", () => {
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const document = body.draft;
      // Content is automatically repaired by the existing migration; Sidebar
      // can stay empty and exercises the empty-root outline drop target.
      document.parts.sidebar.children = [];
      return cy.request({
        method: "PUT",
        url: "/api/themes/" + themeId + "/draft",
        headers,
        body: { revision: body.revision, document },
      });
    });
    cy.reload();
    cy.get('[aria-label="Outline"]').click();
    cy.get(".theme-outline .outline-document-settings").click();
    cy.get(".theme-parts").contains("button", "sidebar").click();
    cy.get('button[aria-label="Outline"]').click();
    cy.get(".theme-outline .outline-document-settings").should(
      "contain.text",
      "Sidebar settings",
    );
    cy.get(".theme-outline .theme-tree-row").should("not.exist");
    cy.get(".theme-outline .theme-drop-zone.empty").should("be.visible");
    cy.get('[aria-label="Add top-level block"]').click();
    cy.get('[aria-label="Find a block to insert"]').type("Heading");
    cy.get(".outline-insert-options").contains("button", "Heading").click();
    cy.get(".theme-outline .theme-tree-row").should(
      "have.attr",
      "aria-level",
      "1",
    );
    cy.window().should((win) => {
      const snapshot = win.colossalThemeEditor.getOutline();
      expect(snapshot.part).eq("sidebar");
      expect(snapshot.root.children[0].type).eq("core/heading");
    });
  });
  it("uses connected dark cards, context actions, inline labels and the shared undo journal", () => {
    cy.get(".outline-surface").should(
      "have.css",
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    row("first-heading").rightclick();
    cy.get('.outline-context-menu:popover-open [role="menuitem"]')
      .contains("Duplicate")
      .click();
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[1].children,
      ).to.have.length(2),
    );
    cy.get('[aria-label="Undo"]').click();
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[1].children,
      ).to.have.length(1),
    );
    cy.get('[aria-label="Redo"]').click();
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[1].children,
      ).to.have.length(2),
    );
    row("group-a").click().trigger("keydown", { key: "F2" });
    cy.get('[aria-label="Block label"]').clear().type("Landing hero{enter}");
    row("group-a").should("contain", "Landing hero").and("be.focused");
    row("group-a").rightclick();
    cy.get(".outline-context-menu:popover-open")
      .contains('[role="menuitem"]', "Copy")
      .click();
    row("group-b").rightclick();
    cy.get(".outline-context-menu:popover-open")
      .contains('[role="menuitem"]', "Paste inside")
      .click();
    cy.window().should((win) => {
      const pasted =
        win.colossalThemeEditor.getOutline().root.children[2].children[1];
      expect(pasted.label).eq("Landing hero");
      expect(pasted.id).not.eq("group-a");
    });
  });
  it("supports keyboard tree navigation, collapse, menu focus and a versioned extension subscription", () => {
    let notifications = 0,
      unsubscribe;
    cy.window().then((win) => {
      unsubscribe = win.colossalThemeEditor.subscribe((snapshot) => {
        expect(snapshot.apiVersion).eq(1);
        notifications++;
      });
    });
    row("group-a").click().trigger("keydown", { key: "ArrowLeft" });
    row("group-a").should("have.attr", "aria-expanded", "false");
    cy.get('[data-outline-id="first-heading"]').should("not.be.visible");
    row("group-a").trigger("keydown", { key: "ArrowRight" });
    row("group-a").should("have.attr", "aria-expanded", "true");
    row("group-a").trigger("keydown", { key: "ArrowRight" });
    row("first-heading").should("be.focused");
    row("first-heading").rightclick();
    cy.get(".outline-context-menu:popover-open")
      .contains('[role="menuitem"]', "Add block")
      .click();
    cy.get('[aria-label="Find a block to insert"]')
      .should("be.focused")
      .type("Spacer{downarrow}");
    cy.focused().should("contain", "Spacer").click();
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[1].children[1].type,
      ).eq("core/spacer"),
    );
    row("first-heading").trigger("keydown", { key: "F10", shiftKey: true });
    cy.get(".outline-context-menu:popover-open").should("be.visible");
    cy.focused().trigger("keydown", { key: "ArrowDown" });
    cy.focused()
      .should("contain", "Rename label")
      .trigger("keydown", { key: "Escape" });
    row("first-heading").should("be.focused");
    cy.then(() => {
      expect(notifications).greaterThan(2);
      unsubscribe();
    });
  });
  it("uses the same selection and collapse state in the compact block-list drawer", () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get('[aria-label="Outline"]').click();
    cy.get('#block-list-drawer [data-outline-id="group-a"] > .theme-tree-row')
      .click()
      .trigger("keydown", { key: "ArrowLeft" });
    cy.get(
      '#block-list-drawer [data-outline-id="group-a"] > .theme-tree-row',
    ).should("have.attr", "aria-expanded", "false");
    cy.get('button[aria-label="Outline"]').click();
    cy.get('[aria-label="Outline"]').click();
    row("group-a")
      .should("have.attr", "aria-expanded", "false")
      .and("have.attr", "aria-selected", "true");
  });
  it("reports the current template when templates reuse their block IDs", () => {
    cy.window().should((win) =>
      expect(win.colossalThemeEditor.getOutline().templateId).eq("home"),
    );
    cy.get('button[aria-label="Choose template"]').click();
    cy.get('[data-template-id="default"].editor-template-card').click();
    cy.window().should((win) => {
      const snapshot = win.colossalThemeEditor.getOutline();
      expect(snapshot.templateId).eq("default");
      expect(snapshot.root.children[1].label).eq("Page hero");
    });
    cy.get('button[aria-label="Choose template"]').click();
    cy.get('[data-template-id="home"].editor-template-card').click();
    cy.window().should((win) => {
      const snapshot = win.colossalThemeEditor.getOutline();
      expect(snapshot.templateId).eq("home");
      expect(snapshot.root.children[1].label).eq("Hero section");
    });
  });
  it("moves blocks into occupied containers and rejects self-nesting without per-frame tree updates", () => {
    const drag = (sourceId, targetId) => {
      const transfer = new DataTransfer();
      row(sourceId).trigger("dragstart", { dataTransfer: transfer });
      row(targetId).then((element) => {
        const target = element[0],
          rect = target.getBoundingClientRect(),
          win = target.ownerDocument.defaultView;
        const options = {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: rect.left + 35,
          clientY: rect.top + rect.height / 2,
        };
        const before = target.getBoundingClientRect();
        for (let i = 0; i < 40; i++)
          target.dispatchEvent(new win.DragEvent("dragover", options));
        expect(target.getBoundingClientRect().height).eq(before.height);
        target.dispatchEvent(new win.DragEvent("drop", options));
      });
    };
    drag("first-heading", "group-b");
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor
          .getOutline()
          .root.children[2].children.map((child) => child.id),
      ).deep.eq(["second-heading", "first-heading"]),
    );
    drag("group-b", "group-b");
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[2].children,
      ).to.have.length(2),
    );
    drag("shared-header", "group-b");
    cy.window().should((win) =>
      expect(
        win.colossalThemeEditor.getOutline().root.children[1].children[2].id,
      ).eq("shared-header"),
    );
    cy.get(".theme-editor-viewport").should("not.have.class", "is-dragging");
  });
});
