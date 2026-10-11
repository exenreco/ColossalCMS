describe("Shared editor workspace", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
  const control = (name) =>
    cy.get(`.shared-editor [aria-label="${name}"]`).filter(":visible");
  const viewport = (name) => {
    control("Viewport").click();
    cy.get('[aria-label="Viewport options"]:popover-open')
      .contains("button", name)
      .click();
  };
  const chooseTemplate = (id) => {
    control("Choose template").click();
    cy.get(
      `[aria-label="Choose template"][open] [data-template-id="${id}"]`,
    ).click();
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
      body: { colorMode: "dark", walkthroughVersion: 1 },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Shared editor fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
      });
  });
  const visitTheme = () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get("iframe.theme-live-preview").should("be.visible");
  };
  const expectCanvasFits = (selector) => {
    cy.get(selector).should((frame) => {
      const rect = frame[0].getBoundingClientRect();
      const canvas = frame[0]
        .closest(".shared-editor-canvas")
        .getBoundingClientRect();
      expect(rect.left).closeTo(canvas.left, 1);
      expect(rect.width).closeTo(canvas.width, 1);
      expect(canvas.right).closeTo(
        frame[0]
          .closest(".shared-editor")
          .classList.contains("inspector-closed")
          ? frame[0].ownerDocument.defaultView.innerWidth
          : frame[0].ownerDocument
              .querySelector(".editor-inspector-sidebar")
              .getBoundingClientRect().left,
        1,
      );
    });
  };
  it("walks through real panels, allows skipping, and remembers dismissal after reload", () => {
    cy.intercept(
      { method: "GET", url: "/api/admin/editor/preferences", times: 1 },
      { colorMode: "dark", walkthroughVersion: 0 },
    );
    visitTheme();
    cy.get('[aria-label="Welcome to the editor"][open]')
      .should("be.visible")
      .contains("button", "Show me around")
      .click();
    cy.get('[aria-label="Editor walkthrough"]:popover-open').should(
      "contain",
      "Start with a block",
    );
    control("Blocks").should("have.attr", "aria-pressed", "true");
    cy.get('[aria-label="Editor walkthrough"]:popover-open')
      .contains("button", "Next")
      .click();
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get('[aria-label="Editor walkthrough"]:popover-open')
      .contains("button", "Next")
      .click();
    control("Outline").should("have.attr", "aria-pressed", "true");
    cy.get(".theme-live-preview").should("be.visible");
    cy.get('[aria-label="Editor walkthrough"]:popover-open')
      .contains("button", "Skip")
      .click();
    cy.request("/api/admin/editor/preferences")
      .its("body.walkthroughVersion")
      .should("eq", 1);
    cy.reload();
    cy.get('[aria-label="Welcome to the editor"]').should(
      "not.have.attr",
      "open",
    );
    control("Replay editor walkthrough").click();
    cy.get('[aria-label="Welcome to the editor"][open]')
      .contains("button", "Skip walkthrough")
      .click();
  });
  it("keeps the canvas visible and fills all remaining space across panels and desktop widths", () => {
    visitTheme();
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get(".block-list-view").should("be.visible");
    for (const width of [1280, 1440, 1920, 2560]) {
      cy.viewport(width, 900);
      cy.get(".shared-editor-canvas").should((canvas) => {
        const r = canvas[0].getBoundingClientRect();
        expect(r.right).closeTo(width, 1);
        expect(r.bottom).closeTo(900, 1);
      });
      cy.get(".theme-live-preview").should((frame) => {
        const r = frame[0].getBoundingClientRect(),
          c = frame[0].closest(".shared-editor-canvas").getBoundingClientRect();
        expect(r.left).closeTo(c.left, 1);
        expect(r.width).closeTo(c.width, 1);
        expect(r.height).closeTo(c.height, 1);
      });
      cy.get(".editor-header-actions").should((actions) => {
        const r = actions[0].getBoundingClientRect();
        expect(r.right).lte(width);
        expect(r.left).gte(396);
      });
    }
    control("Blocks").click();
    cy.get(".block-library").should("be.visible");
    control("Outline").click();
    cy.get(".outline-surface").should("be.visible");
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".theme-workspace .outline-surface").should("not.exist");
    cy.get(".outline-document-settings").click();
    cy.get("#theme-inspector").should("be.visible");
    control("Toggle sidebar").click();
    cy.get(".shared-editor").should("have.class", "sidebar-closed");
    expectCanvasFits(".theme-live-preview");
  });
  it("uses Body appearance for the canvas background and device preview gutters", () => {
    visitTheme();
    const expectBackground = (color, gradient = false) => {
      cy.get(".theme-live-preview").should((frames) => {
        const frame = frames[0],
          doc = frame.contentDocument;
        const appearance = doc.defaultView.getComputedStyle(doc.body);
        const channels = appearance.backgroundColor
          .match(/[\d.]+/g)
          .map(Number);
        const expectedChannels = color.match(/[\d.]+/g).map(Number);
        expect(channels.slice(0, 3)).deep.eq(expectedChannels.slice(0, 3));
        if (expectedChannels.length === 4)
          expect(channels[3]).closeTo(expectedChannels[3], 0.005);
        const canvas = frame.closest(".shared-editor-canvas");
        const backdrop = getComputedStyle(canvas, "::before");
        expect(backdrop.backgroundColor).eq(appearance.backgroundColor);
        expect(backdrop.backgroundImage).eq(appearance.backgroundImage);
        expect(appearance.backgroundImage.includes("gradient")).eq(gradient);
      });
    };
    cy.get(".outline-document-settings").click();
    const background =
      ".theme-inspector cl-appearance-picker-panel cl-color-picker:nth-of-type(2)";
    cy.get(background).find(".cl-picker-trigger").click();
    cy.get(background)
      .contains("label", "HEX")
      .find("input")
      .invoke("val", "#23456780")
      .trigger("input");
    expectBackground("rgba(35, 69, 103, 0.502)");
    cy.get(background).find(".cl-picker-trigger").click();
    viewport("Mobile");
    cy.get(".theme-live-preview").should("have.css", "width", "390px");
    expectBackground("rgba(35, 69, 103, 0.502)");
    control("Switch to light mode").click();
    expectBackground("rgba(35, 69, 103, 0.502)");
    cy.get(".theme-inspector cl-gradient-picker .cl-picker-trigger").click();
    cy.get(".theme-inspector cl-gradient-picker")
      .contains("button", "Radial")
      .click();
    expectBackground("rgba(35, 69, 103, 0.502)", true);
    cy.get(".theme-inspector cl-gradient-picker")
      .contains("button", "Clear gradient")
      .click();
    expectBackground("rgba(35, 69, 103, 0.502)");
    cy.get(".theme-inspector cl-gradient-picker .cl-picker-trigger").click();
    cy.get(background).find(".cl-picker-trigger").click();
    cy.get(background).contains("button", "Reset background color").click();
    expectBackground("rgb(247, 249, 243)");
    cy.get(background).find(".cl-picker-trigger").click();
    viewport("Fit canvas");
    expectCanvasFits(".theme-live-preview");
    chooseTemplate("default");
    expectBackground("rgb(247, 249, 243)");
  });
  it("toggles the right Inspector independently, preserves its scroll and restores focus on Escape", () => {
    visitTheme();
    cy.viewport(1440, 900);
    const inspector = () => cy.get(".editor-inspector-sidebar");
    control("Toggle Inspector").should("have.attr", "aria-expanded", "false");
    cy.get(".editor-header-actions button").then((buttons) => {
      const names = Array.from(buttons, (button) =>
        button.getAttribute("aria-label"),
      );
      expect(names.indexOf("Toggle Inspector")).eq(
        names.indexOf("Save draft") + 1,
      );
      expect(names.indexOf("Editor settings")).eq(
        names.indexOf("Toggle Inspector") + 1,
      );
    });
    control("Toggle Inspector").click();
    inspector()
      .should("have.attr", "aria-hidden", "false")
      .and("contain", "Body");
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get(".editor-sidebar [editor-inspector]").should("not.exist");
    cy.get(".editor-panel-selector").click();
    cy.get('[aria-label="Sidebar panels"]:popover-open')
      .should("not.contain", "Inspector")
      .contains("button", "Outline")
      .click();
    inspector().should("have.attr", "aria-hidden", "false");
    cy.get(".shared-editor-canvas").should((canvas) => {
      const doc = canvas[0].ownerDocument;
      expect(canvas[0].getBoundingClientRect().right).closeTo(
        doc.querySelector(".editor-inspector-sidebar").getBoundingClientRect()
          .left,
        1,
      );
    });
    cy.get(".editor-inspector-scroll").scrollTo(0, 180);
    control("Toggle Inspector").click();
    inspector().should("have.attr", "inert");
    control("Toggle Inspector").click();
    cy.get(".editor-inspector-scroll").should((scroll) =>
      expect(scroll[0].scrollTop).eq(180),
    );
    control("Close Inspector").focus().trigger("keydown", { key: "Escape" });
    control("Toggle Inspector")
      .should("be.focused")
      .and("have.attr", "aria-expanded", "false");
    control("Outline").should("have.attr", "aria-pressed", "true");
    cy.get(".shared-editor-canvas").should((canvas) =>
      expect(canvas[0].getBoundingClientRect().right).closeTo(1440, 1),
    );
  });
  it("uses a right overlay on mobile and switches sidebars without covering toolbar controls", () => {
    visitTheme();
    cy.viewport(640, 820);
    control("Toggle Inspector").click();
    cy.get(".shared-editor").should("have.class", "sidebar-closed");
    cy.get(".editor-inspector-sidebar")
      .should("have.attr", "aria-hidden", "false")
      .and((sidebar) => {
        const rect = sidebar[0].getBoundingClientRect();
        expect(rect.right).closeTo(640, 1);
        expect(rect.top).closeTo(106, 1);
      });
    control("Blocks").click();
    cy.get(".shared-editor")
      .should("have.class", "inspector-closed")
      .and("not.have.class", "sidebar-closed");
    cy.get(".block-library").should("be.visible");
    control("Toggle Inspector").click();
    cy.get(".editor-inspector-scrim").should("be.visible").click("left");
    control("Toggle Inspector").should("have.attr", "aria-expanded", "false");
  });
  it("offers icon viewports, themed keyboard menus, metadata draft saves and template selection", () => {
    visitTheme();
    control("Viewport").click();
    cy.get(
      '[aria-label="Viewport options"]:popover-open [role="menuitem"] cl-editor-icon',
    ).should("have.length.gte", 4);
    cy.get('[aria-label="Viewport options"]:popover-open button')
      .first()
      .trigger("keydown", { key: "End" });
    cy.focused().should("contain", "Mobile").click();
    cy.get(".theme-live-preview").should("have.css", "width", "390px");
    viewport("Tablet");
    cy.get(".theme-live-preview").should("have.css", "width", "768px");
    viewport("Fit canvas");
    control("Switch to light mode").click();
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "light");
    control("Theme preview").click();
    cy.get('[aria-label="Theme details"]:popover-open')
      .should("be.visible")
      .within(() =>
        cy
          .get('[aria-label="Theme name"]')
          .clear()
          .type("Updated theme details"),
      );
    control("Close theme details").click();
    control("Save draft").click();
    cy.get(".editor-sidebar-footer").should("contain", "Draft saved");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      expect(body.draft.manifest.name).eq("Updated theme details");
      expect(body.published.manifest.name).eq("Shared editor fixture");
    });
    chooseTemplate("default");
    cy.get(".theme-editor").should("have.attr", "data-template-id", "default");
    cy.get(".shared-editor").trigger("keydown", { key: "k", ctrlKey: true });
    cy.get('[aria-label="Choose template"][open]')
      .should("be.visible")
      .contains("button", "Home")
      .click();
    cy.reload();
    cy.get(".shared-editor").should("have.attr", "data-color-mode", "light");
  });
  it("uses the same workspace for maintenance layouts", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.maintenance", action: "install" },
      failOnStatusCode: false,
    });
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.maintenance", action: "activate" },
    });
    cy.request("/api/maintenance").then(({ body }) => {
      cy.visit("/admin/maintenance/edit/" + body.layouts[0].id);
    });
    cy.get(".editor-breadcrumb").should("contain", "Maintenance");
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get(".block-list-view").should("be.visible");
    control("Outline").click();
    cy.get(".outline-document-settings").should("contain", "Body settings");
    cy.get(".theme-live-preview").should("be.visible");
    control("Blocks").click();
    cy.get('[data-library-block="core/heading"]').first().click();
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("Maintenance editor sample");
    control("Save draft").click();
    cy.get(".editor-sidebar-footer").should("contain", "Draft saved");
    control("Outline").click();
    cy.get(".outline-surface").should("contain", "Maintenance editor sample");
    cy.get(".theme-live-preview").should("be.visible");
  });
  for (const kind of ["post", "page"])
    it(`shares the chrome with ${kind}s, keeps Main content in the canvas, and preserves HTML`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Shared ${kind} editor`);
      control("List view").should("have.attr", "aria-pressed", "true");
      cy.get(".block-list-view").should("be.visible");
      cy.viewport(2560, 900);
      expectCanvasFits(".content-live-preview");
      control("Toggle sidebar").click();
      cy.get(".shared-editor").should("have.class", "sidebar-closed");
      expectCanvasFits(".content-live-preview");
      control("Toggle sidebar").click();
      control("Outline").click();
      cy.get(".content-theme-outline")
        .should("be.visible")
        .contains("Main settings");
      cy.get(".content-live-preview")
        .should("be.visible")
        .should((frame) => {
          const doc = frame[0].contentDocument;
          expect(doc.querySelector("main.content-main")).not.eq(null);
          expect(doc.querySelector(".theme-part-header,.theme-part-footer")).eq(
            null,
          );
        });
      control("Blocks").click();
      cy.get(".block-library").contains("button", "Heading").click();
      control("Outline").click();
      cy.get('[data-block-type="core/heading"] .theme-node-label').click();
      cy.get(".contextual-block-toolbar").should("be.visible");
      cy.get(".contextual-block-toolbar select").each((select) => {
        cy.wrap(select)
          .parent()
          .find(".editor-select-chevron")
          .should("be.visible");
      });
      cy.get(".editor-mode-switch button").contains("HTML").click();
      cy.get('[aria-label="HTML source"]')
        .clear()
        .type(
          '<div class="custom-card"><h2>Safe custom markup</h2><p>Preserved content.</p></div>',
          { parseSpecialCharSequences: false },
        );
      cy.get(".editor-mode-switch button").contains("Blocks").click();
      control("Save draft").click();
      cy.get(".editor-sidebar-footer").should("contain", "saved");
      cy.request("/api/admin/state").then(({ body }) => {
        const content = body.content.find(
          (c) => c.title === `Shared ${kind} editor`,
        );
        expect(
          content.details.contentBlocks.some((b) =>
            b.settings.html?.includes('class="custom-card"'),
          ),
        ).eq(true);
      });
    });
});
