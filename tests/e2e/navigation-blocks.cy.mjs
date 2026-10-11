Cypress.Commands.addQuery(
  "navigationCanvas",
  function (selector, frame = ".theme-live-preview") {
    return () =>
      Cypress.$(
        cy
          .state("document")
          .querySelector(frame)
          ?.contentDocument?.querySelectorAll(selector) || [],
      );
  },
);
describe("Button and responsive Menu blocks", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () =>
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  let themeId;
  let pageId;
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
      body: { walkthroughVersion: 1, colorMode: "dark" },
    });
    cy.request({
      method: "POST",
      url: "/api/admin/content",
      headers,
      body: {
        kind: "page",
        title: "Menu example page",
        slug: "menu-example",
        body: "Example",
        excerpt: "",
        status: "published",
        details: {},
      },
    }).then(({ body }) => {
      pageId = body.id;
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Navigation test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.published;
        document.templates.home.children = [
          {
            id: "blk_toolbar_row",
            type: "core/row",
            settings: {},
            children: [
              {
                id: "blk_toolbar_first",
                type: "core/paragraph",
                settings: { text: "First toolbar paragraph" },
              },
              {
                id: "blk_toolbar_second",
                type: "core/paragraph",
                settings: { text: "Second toolbar paragraph" },
              },
            ],
          },
          {
            id: "blk_menu_browser",
            type: "core/menu",
            settings: { automaticPages: false },
            children: [
              {
                id: "blk_home_browser",
                type: "core/menu-item",
                settings: { label: "Home", href: "/" },
                children: [],
              },
              {
                id: "blk_explore_browser",
                type: "core/menu-item",
                settings: { label: "Explore", href: "#" },
                children: [
                  {
                    id: "blk_child_browser",
                    type: "core/menu-item",
                    settings: { label: "Our page", pageId },
                    children: [],
                  },
                ],
              },
              {
                id: "blk_button_browser",
                type: "core/button",
                settings: {
                  text: "Contact",
                  href: "/contact",
                  iconName: "arrow-right",
                  iconPosition: "after",
                },
              },
            ],
          },
        ];
        // Keep Menu first for the persistence assertions below.
        document.templates.home.children.reverse();
        document.templates.home.children.push({
          id: "blk_toolbar_grid",
          type: "core/columns",
          settings: {},
          children: [
            {
              id: "blk_toolbar_column_one",
              type: "core/column",
              settings: {},
              children: [
                {
                  id: "blk_toolbar_column_text_one",
                  type: "core/paragraph",
                  settings: { text: "Grid one" },
                },
              ],
            },
            {
              id: "blk_toolbar_column_two",
              type: "core/column",
              settings: {},
              children: [
                {
                  id: "blk_toolbar_column_text_two",
                  type: "core/paragraph",
                  settings: { text: "Grid two" },
                },
              ],
            },
          ],
        });
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  it("keeps three toolbar columns, scrolls tools, and moves, duplicates and deletes blocks", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_first"] [data-paragraph-editor]',
    ).click();
    cy.get(".contextual-block-toolbar").within(() => {
      cy.get(".block-toolbar-identity cl-block-icon").should("exist");
      cy.get(".block-toolbar-tools").should("exist");
      cy.get(".block-toolbar-actions").find("button").should("have.length", 7);
      cy.get('[aria-label="Paste block"]').should("be.disabled");
      cy.get('[aria-label="Copy block"]').click();
      cy.get('[aria-label="Paste block"]').should("not.be.disabled").click();
    });
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_row"] > .theme-layout > [data-block-id]',
    ).should("have.length", 3);
    cy.get('.contextual-block-toolbar [aria-label="Delete block"]').click();
    cy.navigationCanvas('[data-block-id="blk_toolbar_first"]').click();
    cy.get(".contextual-block-toolbar").within(() => {
      cy.get('[aria-label="Move block left"]').should("be.disabled");
      cy.get('[aria-label="Move block right"]')
        .should("not.be.disabled")
        .click();
    });
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_row"] > .theme-layout > [data-block-id]',
    )
      .first()
      .should("have.attr", "data-block-id", "blk_toolbar_second");
    cy.get('.contextual-block-toolbar [aria-label="Duplicate block"]').click();
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_row"] > .theme-layout > [data-block-id]',
    ).should("have.length", 3);
    cy.get('.contextual-block-toolbar [aria-label="Delete block"]').click();
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_row"] > .theme-layout > [data-block-id]',
    ).should("have.length", 2);
    control("Viewport").click();
    cy.get('[aria-label="Viewport options"]:popover-open')
      .contains("button", "Desktop")
      .click();
    control("Outline").click();
    cy.get(
      '[data-outline-id="blk_toolbar_column_one"] > .theme-tree-row .theme-node-label',
    ).click();
    cy.get('.contextual-block-toolbar [aria-label="Move block right"]').should(
      "exist",
    );
    control("Viewport").click();
    cy.get('[aria-label="Viewport options"]:popover-open')
      .contains("button", "Mobile")
      .click();
    cy.get('.contextual-block-toolbar [aria-label="Move block down"]').should(
      "exist",
    );
    cy.navigationCanvas('[data-block-id="blk_toolbar_second"]').click();
    cy.get('.contextual-block-toolbar [aria-label="Move block left"]').should(
      "exist",
    );
    control("Toggle Inspector").click();
    control("Outline").click();
    // Narrow the browser as well so the fixed action columns leave an overflowing tool strip.
    cy.viewport(640, 900);
    cy.get('.contextual-block-toolbar [aria-label="Next block tools"]')
      .should("not.be.disabled")
      .click();
    cy.get(".block-toolbar-scroll").should((el) =>
      expect(el[0].scrollLeft).greaterThan(0),
    );
    cy.get('.contextual-block-toolbar [aria-label="Previous block tools"]')
      .should("not.be.disabled")
      .click();
    cy.get(".block-toolbar-scroll").should((el) =>
      expect(el[0].scrollLeft).lessThan(2),
    );
    cy.get('.contextual-block-toolbar [aria-label="Drag block"]').should(
      "have.attr",
      "draggable",
      "true",
    );
    const transfer = new DataTransfer();
    cy.get('.contextual-block-toolbar [aria-label="Drag block"]').trigger(
      "dragstart",
      { dataTransfer: transfer },
    );
    cy.get('.contextual-block-toolbar [aria-label="Drag block"]').should(
      "exist",
    );
    cy.navigationCanvas('[data-block-id="blk_toolbar_first"]').then((block) => {
      const rect = block[0].getBoundingClientRect();
      const Event = block[0].ownerDocument.defaultView.DragEvent;
      const point = {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: rect.left + rect.width / 2,
        clientY: rect.bottom - 1,
      };
      block[0].dispatchEvent(new Event("dragover", point));
      block[0].dispatchEvent(new Event("drop", point));
    });
    cy.navigationCanvas(
      '[data-block-id="blk_toolbar_row"] > .theme-layout > [data-block-id]',
    )
      .first()
      .should("have.attr", "data-block-id", "blk_toolbar_first");
  });
  it("reveals dropdown children selected in Outline and allows manual collapse", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    control("Outline").click();
    cy.get(
      '[data-outline-id="blk_child_browser"] > .theme-tree-row .theme-node-label',
    ).click();
    cy.navigationCanvas(
      '[data-block-id="blk_explore_browser"] > .theme-menu-dropdown',
    ).should("have.attr", "open");
    cy.navigationCanvas(
      '[data-block-id="blk_child_browser"] .theme-menu-link',
    ).should("be.visible");
    cy.navigationCanvas(
      '[data-block-id="blk_explore_browser"] > .theme-menu-dropdown > summary > span',
    ).click();
    cy.navigationCanvas(
      '[data-block-id="blk_explore_browser"] > .theme-menu-dropdown',
    ).should("not.have.attr", "open");
    cy.get(
      '[data-outline-id="blk_menu_browser"] > .theme-tree-row .theme-node-label',
    ).click();
    cy.navigationCanvas(
      '[data-block-id="blk_child_browser"] .theme-menu-link',
    ).should("be.visible");
  });
  it("edits a Menu Item block, chooses a page, and saves its appearance", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] .theme-menu-link',
    ).click();
    inspector();
    cy.get("cl-menu-page-picker")
      .contains("button", "Choose site page")
      .click();
    cy.get('dialog[aria-label="Choose menu item page"][open]').within(() => {
      cy.get('[aria-label="Find site pages"]').type("Menu example");
      cy.contains("button", "Menu example page").click();
    });
    cy.get(".editor-inspector-sidebar")
      .contains("label", "Item label")
      .find("input")
      .type("Studio");
    cy.navigationCanvas('[data-block-id="blk_home_browser"] .theme-menu-link')
      .should("have.attr", "href", "/menu-example")
      .and("contain", "Studio");
    cy.get("cl-typography-picker").should("exist");
    cy.intercept("PUT", "/api/themes/*/draft").as("save");
    control("Save draft").click();
    cy.wait("@save");
    cy.reload();
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] .theme-menu-link',
    ).should("contain", "Studio");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.templates.home.children[0].settings).not.have.property(
        "items",
      );
      expect(body.draft.templates.home.children[0].children[0].type).eq(
        "core/menu-item",
      );
    });
  });
  it("nests menu blocks by dragging in Outline and keeps the dropdown after saving", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    control("Outline").click();
    const transfer = new DataTransfer();
    cy.get('[data-outline-id="blk_child_browser"] > .theme-tree-row').trigger(
      "dragstart",
      { dataTransfer: transfer },
    );
    cy.get('[data-outline-id="blk_home_browser"] > .theme-tree-row').then(
      (row) => {
        const rect = row[0].getBoundingClientRect();
        const point = {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        };
        const Event = row[0].ownerDocument.defaultView.DragEvent;
        row[0].dispatchEvent(new Event("dragover", point));
        row[0].dispatchEvent(new Event("drop", point));
      },
    );
    cy.get(
      '[data-outline-id="blk_home_browser"] [data-outline-id="blk_child_browser"]',
    ).should("exist");
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] .theme-menu-dropdown',
    ).should("exist");
    cy.intercept("PUT", "/api/themes/*/draft").as("save");
    control("Save draft").click();
    cy.wait("@save");
    cy.reload();
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] [data-block-id="blk_child_browser"]',
    ).should("exist");
  });
  it("inserts Menu Item and Button children and opens mobile dropdowns", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.navigationCanvas(".theme-menu").click("topLeft");
    control("Blocks").click();
    cy.get('[data-library-block="core/menu-item"]').click();
    inspector();
    cy.get(".editor-inspector-sidebar")
      .contains("label", "Item label")
      .find("input")
      .type("New dropdown");
    cy.get('[data-library-block="core/button"]').click();
    cy.navigationCanvas(".theme-menu-dropdown .theme-button").should("exist");
    control("Viewport").click();
    cy.get('[aria-label="Viewport options"]:popover-open')
      .contains("button", "Mobile")
      .click();
    cy.navigationCanvas(".theme-menu-toggle")
      .should("have.attr", "aria-expanded", "true")
      .click()
      .should("have.attr", "aria-expanded", "false")
      .click()
      .should("have.attr", "aria-expanded", "true");
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] > .theme-menu-dropdown',
    ).then((dropdown) => {
      // The editor may retain an expanded dropdown after inserting its children.
      if (dropdown.attr("open") !== undefined)
        cy.navigationCanvas(
          '[data-block-id="blk_home_browser"] > .theme-menu-dropdown > summary > span',
        ).click();
    });
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] > .theme-menu-dropdown',
    ).should("not.have.attr", "open");
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] > .theme-menu-dropdown > summary > span',
    ).click();
    cy.navigationCanvas(
      '[data-block-id="blk_home_browser"] > .theme-menu-dropdown',
    ).should("have.attr", "open");
    cy.navigationCanvas(".theme-menu-toggle").trigger("keydown", {
      key: "Escape",
    });
    cy.navigationCanvas(".theme-menu-items").should("not.be.visible");
  });
  it("inserts and saves a Custom Link inside a theme menu dropdown", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.navigationCanvas('[data-block-id="blk_home_browser"] .theme-menu-link')
      .first()
      .click();
    control("Blocks").then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get('[data-library-block="core/custom-link"]').click();
    inspector();
    cy.get(".editor-inspector-sidebar")
      .contains("label", "Link text")
      .find("input")
      .clear()
      .type("Custom documentation");
    cy.get(".editor-inspector-sidebar")
      .contains("label", "Link URL")
      .find("input")
      .clear()
      .type("https://example.com/docs");
    cy.navigationCanvas(
      '.theme-menu-dropdown .theme-menu-link[href="https://example.com/docs"]',
    ).should("contain", "Custom documentation");
    control("Save draft").click();
    cy.contains("Draft saved").should("exist");
    cy.reload();
    cy.navigationCanvas(
      '.theme-menu-dropdown .theme-menu-link[href="https://example.com/docs"]',
    ).should("contain", "Custom documentation");
  });
  it("deletes custom templates with confirmation, undo, and draft persistence", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    control("Choose template").click();
    cy.get('dialog[aria-label="Choose template"][open]').within(() => {
      cy.get('[aria-label="Delete template Home"]').should("not.exist");
      cy.get('[aria-label="New template name"]').type("Disposable template");
      cy.contains("button", "Create").click();
    });
    cy.navigationCanvas(".theme-menu").should("not.exist");
    cy.intercept("PUT", "/api/themes/*/draft").as("newEmptyTemplate");
    control("Save draft").click();
    cy.wait("@newEmptyTemplate");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const root = body.draft.templates["disposable-template"];
      expect(root.settings).deep.eq(body.draft.templates.home.settings);
      expect(root.id).not.eq(body.draft.templates.home.id);
      expect(root.children).to.have.length(1);
      expect(root.children[0].type).eq("core/paragraph");
      expect(root.children[0].settings.html || "").eq("");
      expect(root.children[0].settings.text || "").eq("");
    });
    cy.location("search").should("include", "template=disposable-template");
    cy.reload();
    cy.get('.theme-editor[data-template-id="disposable-template"]').should(
      "exist",
    );
    control("Choose template").click();
    cy.get('.editor-template-card[data-part="header"]').click();
    cy.location("search").should("include", "part=header");
    cy.reload();
    control("Choose template").click();
    cy.get('.editor-template-card[data-part="header"]').should(
      "have.attr",
      "aria-pressed",
      "true",
    );
    cy.get(
      '.editor-template-card[data-template-id="disposable-template"]',
    ).click();
    control("Choose template").click();
    cy.get('[aria-label="Delete template Disposable template"]').click();
    cy.get('dialog[aria-label="Delete template?"][open]')
      .contains("button", "Cancel")
      .click();
    cy.get('[aria-label="Delete template Disposable template"]')
      .should("exist")
      .click();
    cy.get('dialog[aria-label="Delete template?"][open]')
      .contains("button", "Delete template")
      .click();
    cy.get('[aria-label="Delete template Disposable template"]').should(
      "not.exist",
    );
    cy.get('.theme-editor[data-template-id="home"]').should("exist");
    control("Close templates").click();
    control("Undo").click();
    control("Choose template").click();
    cy.get('[aria-label="Delete template Disposable template"]')
      .should("exist")
      .click();
    cy.get('dialog[aria-label="Delete template?"][open]')
      .contains("button", "Delete template")
      .click();
    control("Close templates").click();
    cy.intercept("PUT", "/api/themes/*/draft").as("deleteTemplateSave");
    control("Save draft").click();
    cy.wait("@deleteTemplateSave");
    cy.reload();
    control("Choose template").click();
    cy.get('[aria-label="Delete template Disposable template"]').should(
      "not.exist",
    );
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.templates).not.have.property("disposable-template");
      expect(
        body.draft.manifest.templates.some(
          (t) => t.id === "disposable-template",
        ),
      ).eq(false);
    });
  });
  it("shows selectable placeholders for empty layout and media blocks only in the editor", () => {
    const empty = (type, settings = {}, children) => ({
      id: "blk_placeholder_" + type.slice(5),
      type,
      settings,
      ...(children ? { children } : {}),
    });
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const document = body.draft || body.published;
      document.manifest.templates.push({
        id: "placeholder-preview",
        name: "Placeholder preview",
        file: "templates/placeholder-preview.html",
        appliesTo: ["page"],
      });
      document.templates["placeholder-preview"] = {
        id: "blk_placeholder_root",
        type: "core/container",
        settings: {},
        children: [
          ...["row", "container", "columns", "slider", "group"].map((type) =>
            empty("core/" + type, {}, []),
          ),
          empty("core/image", { source: "url", url: "" }),
          empty("core/button", { text: "", href: "/", iconPosition: "none" }),
          empty("core/icon", { iconName: "" }),
          empty("core/menu", { automaticPages: false }, []),
          empty("core/featured-image"),
          empty("core/media", { source: "url", url: "" }),
          empty("core/gltf", { source: "media", mediaId: "", alt: "" }, [
            empty("core/overlay", {}, []),
          ]),
        ],
      };
      return cy.request({
        method: "PUT",
        url: "/api/themes/" + themeId + "/draft",
        headers,
        body: { revision: body.revision, document },
      });
    });
    cy.visit("/admin/themes/edit/" + themeId);
    control("Choose template").click();
    cy.get(
      '.editor-template-card[data-template-id="placeholder-preview"]',
    ).click();
    for (const type of [
      "row",
      "container",
      "columns",
      "slider",
      "group",
      "overlay",
      "image",
      "button",
      "icon",
      "menu",
      "featured-image",
      "gltf",
      "media",
    ]) {
      cy.navigationCanvas(
        '[data-block-id="blk_placeholder_' +
          type +
          '"] .cl-editor-block-placeholder',
      ).should("exist");
    }
    cy.navigationCanvas(
      '[data-block-id="blk_placeholder_image"] .cl-editor-block-placeholder',
    ).click();
    cy.get(
      '.contextual-block-toolbar[aria-label="Block tools for Image"]',
    ).should("be.visible");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(JSON.stringify(body.draft)).not.contain(
        "cl-editor-block-placeholder",
      );
    });
  });
  it("populates a newly inserted theme Menu once with editable published site pages", () => {
    let expected;
    cy.request("/api/admin/state").then(({ body }) => {
      expected = body.content
        .filter(
          (page) =>
            page.kind === "page" &&
            page.status === "published" &&
            page.id !== body.settings.notFoundPageId,
        )
        .map((page) => page.id);
    });
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get(".outline-document-settings").click();
    control("Blocks").then(($button) => {
      if ($button.attr("aria-pressed") !== "true") cy.wrap($button).click();
    });
    cy.get('[data-library-block="core/menu"]').click();
    cy.navigationCanvas('.theme-menu-link[href="/menu-example"]').should(
      "exist",
    );
    control("Save draft").click();
    cy.contains("Draft saved").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const menu = body.draft.templates.home.children.at(-1);
      expect(menu.type).eq("core/menu");
      expect(menu.settings.automaticPages).eq(false);
      expect(menu.children.map((item) => item.settings.pageId)).deep.eq(
        expected,
      );
      expect(new Set(menu.children.map((item) => item.id)).size).eq(
        expected.length,
      );
    });
    cy.reload();
    cy.navigationCanvas('.theme-menu-link[href="/menu-example"]').should(
      "exist",
    );
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.templates.home.children.at(-1).children).to.have.length(
        expected.length,
      );
    });
  });
  for (const kind of ["post", "page"])
    it(`uses Menu Item blocks in the ${kind} editor`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('input[aria-label="Title"]').type("Menu items " + kind);
      control("Blocks").click();
      cy.get('[data-library-block="core/image"]').click();
      cy.navigationCanvas(
        '[aria-label="Image placeholder"]',
        ".content-live-preview",
      ).should("exist");
      cy.get('[data-library-block="core/menu"]').click();
      cy.navigationCanvas(
        '.theme-menu-link[href="/menu-example"]',
        ".content-live-preview",
      ).should("exist");
      cy.get('[data-library-block="core/menu-item"]').click();
      inspector();
      cy.get("cl-menu-page-picker")
        .contains("button", "Choose site page")
        .click();
      cy.get('dialog[aria-label="Choose menu item page"][open]')
        .contains("button", "Menu example page")
        .click();
      cy.navigationCanvas(
        '.theme-menu-link[href="/menu-example"]',
        ".content-live-preview",
      ).should("have.attr", "href", "/menu-example");
      cy.get('[data-library-block="core/custom-link"]').click();
      cy.get(".editor-inspector-sidebar")
        .contains("label", "Link text")
        .find("input")
        .clear()
        .type("Documentation");
      cy.get(".editor-inspector-sidebar")
        .contains("label", "Link URL")
        .find("input")
        .clear()
        .type("https://example.com/docs");
      cy.navigationCanvas(
        '.theme-menu-link[href="https://example.com/docs"]',
        ".content-live-preview",
      ).should("contain", "Documentation");
      control("Save draft").click();
      cy.contains("All changes saved").should("exist");
      cy.reload();
      cy.navigationCanvas(
        '.theme-menu-link[href="https://example.com/docs"]',
        ".content-live-preview",
      ).should("contain", "Documentation");
      cy.navigationCanvas(
        '.theme-menu-link[href="/menu-example"]',
        ".content-live-preview",
      ).should("have.attr", "href", "/menu-example");
    });
});
