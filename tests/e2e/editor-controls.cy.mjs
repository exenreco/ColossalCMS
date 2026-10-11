describe("Shared editor controls and surfaces", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const row = (id) => cy.get(`[data-outline-id="${id}"] > .theme-tree-row`);
  const modal = () => cy.get(".editor-confirmation[open]");
  const shortcut = { key: "L", ctrlKey: true, shiftKey: true };
  const canvasShortcut = (selector) =>
    cy
      .get(selector)
      .should((frames) =>
        expect(
          frames[0].contentDocument.querySelector("#cl-editor-scrollbars"),
        ).not.eq(null),
      )
      .then((frames) => {
        const doc = frames[0].contentDocument;
        doc.body.dispatchEvent(
          new doc.defaultView.KeyboardEvent("keydown", {
            ...shortcut,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
  const visit = () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".block-list-view").should("be.visible");
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
          body: { revision: body.revision, name: "Editor controls fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.draft || body.published;
        // A theme's native-looking viewport scrollbar must not override editor chrome.
        document.css +=
          "\nhtml::-webkit-scrollbar{width:18px}html::-webkit-scrollbar-track{background:#fff}html::-webkit-scrollbar-button{display:block}";
        document.templates.home = {
          id: "controls-body",
          type: "core/container",
          settings: {},
          children: [
            {
              id: "controls-columns",
              type: "core/columns",
              settings: {},
              children: [
                {
                  id: "controls-column",
                  type: "core/column",
                  settings: {},
                  children: [
                    {
                      id: "controls-title",
                      type: "core/heading",
                      settings: { text: "A single column", level: "h2" },
                    },
                  ],
                },
              ],
            },
            ...Array.from({ length: 22 }, (_, i) => ({
              id: "controls-heading-" + i,
              type: "core/heading",
              settings: { text: "Section " + (i + 1), level: "h2" },
            })),
          ],
        };
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });

  it("opens List with a documented keyboard command from the workspace and canvas, and leaves text fields alone", () => {
    visit();
    control("List view")
      .should("have.attr", "aria-keyshortcuts", "Control+Shift+L Meta+Shift+L")
      .and("have.attr", "title", "List view (Ctrl/Cmd+Shift+L)");
    control("Outline").click();
    cy.get(".shared-editor").trigger("keydown", shortcut);
    control("List view").should("have.attr", "aria-pressed", "true");
    cy.get(".shared-editor").trigger("keydown", shortcut);
    cy.get(".block-list-view").should("be.visible");
    row("controls-title").trigger("keydown", {
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });
    cy.get(".shared-editor").should("have.class", "sidebar-closed");
    canvasShortcut(".theme-live-preview");
    control("List view").should("have.attr", "aria-pressed", "true");
    control("Blocks").click();
    cy.get('[aria-label="Search blocks"]').trigger("keydown", shortcut);
    control("Blocks").should("have.attr", "aria-pressed", "true");
    cy.get(".shared-editor").trigger("keydown", {
      key: "L",
      metaKey: true,
      shiftKey: true,
    });
    cy.get(".editor-panel-selector").click();
    cy.get('[aria-label="Sidebar panels"]:popover-open')
      .contains("button", "List view")
      .find("kbd")
      .should("contain", "L");
    cy.get('[aria-label="Sidebar panels"]:popover-open')
      .contains("button", "List view")
      .click();
  });

  it("matches canvas and Outline scrollbars in both modes and keeps menus accessible on mobile", () => {
    visit();
    control("Outline").click();
    const expectScrollbars = () =>
      cy.get(".theme-live-preview").should((frames) => {
        const doc = frames[0].contentDocument;
        const root = doc.defaultView.getComputedStyle(doc.documentElement);
        const sidebar = frames[0].ownerDocument.querySelector(
          ".editor-sidebar-scroll",
        );
        const style = getComputedStyle(sidebar);
        expect(root.scrollbarWidth).eq(style.scrollbarWidth);
        expect(root.scrollbarColor).eq(style.scrollbarColor);
        for (const [pseudo, property] of [
          ["::-webkit-scrollbar", "width"],
          ["::-webkit-scrollbar-thumb", "backgroundColor"],
          ["::-webkit-scrollbar-track", "backgroundColor"],
          ["::-webkit-scrollbar-button", "display"],
        ]) {
          const actual = doc.defaultView.getComputedStyle(
            doc.documentElement,
            pseudo,
          )[property];
          expect(actual).eq(getComputedStyle(sidebar, pseudo)[property]);
          if (property === "width") expect(actual).eq("5px");
          if (property === "display") expect(actual).eq("none");
        }
        expect(doc.querySelectorAll("#cl-editor-scrollbars")).to.have.length(1);
        expect(doc.documentElement.scrollHeight).gt(
          doc.documentElement.clientHeight,
        );
        expect(sidebar.scrollHeight).gt(sidebar.clientHeight);
      });
    expectScrollbars();
    control("Switch to light mode").click();
    expectScrollbars();
    for (const name of [
      "Theme preview",
      "Editor settings",
      "Choose template",
      "Viewport",
    ])
      control(name)
        .find(".editor-small-chevron")
        .should("have.length", 1)
        .and("have.css", "width", "16px")
        .find("svg path")
        .should("have.attr", "d", "M5 9l7 7 7-7");
    cy.viewport(390, 844);
    cy.get(".editor-header-actions button").should((buttons) => {
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        expect(rect.left).gte(54);
        expect(rect.right).lte(390);
      }
    });
    control("Editor settings")
      .click()
      .should("have.attr", "aria-expanded", "true");
    cy.get('[aria-label="Editor settings"]:popover-open')
      .should("be.visible")
      .trigger("keydown", { key: "Escape" });
    control("Editor settings").should("have.attr", "aria-expanded", "false");
  });

  it("shows visible carets on block toolbar selects and preserves select changes and undo", () => {
    visit();
    row("controls-title").find(".theme-node-label").click();
    cy.get(".contextual-block-toolbar select").each((select) => {
      cy.wrap(select)
        .parent()
        .find(".editor-select-chevron")
        .should("be.visible")
        .and("have.css", "width", "16px");
      cy.wrap(select).should("have.css", "padding-right", "28px");
    });
    cy.get('.contextual-block-toolbar [aria-label="Alignment"]').select(
      "center",
    );
    cy.get(".theme-live-preview").should((frames) => {
      const doc = frames[0].contentDocument;
      const heading = doc.querySelector('[data-block-id="controls-title"]');
      expect(doc.defaultView.getComputedStyle(heading).textAlign).eq("center");
    });
    control("Undo").click();
    cy.get('.contextual-block-toolbar [aria-label="Alignment"]').should(
      "have.value",
      "left",
    );
  });

  it("points toolbar popovers at their triggers in both modes and keeps short-screen content scrollable", () => {
    visit();
    const options = [
      ["Viewport", "Viewport options"],
      ["Theme preview", "Theme details"],
      ["Editor settings", "Editor settings"],
    ];
    for (const mode of ["dark", "light"]) {
      if (mode === "light") control("Switch to light mode").click();
      for (const [width, height] of [
        [1280, 800],
        [390, 380],
      ]) {
        cy.viewport(width, height);
        for (const [trigger, label] of options) {
          control(trigger).click();
          const surface = () =>
            cy.get(`dialog[aria-label="${label}"]:popover-open`);
          surface().should("have.class", "cl-ui-pointed").and("be.visible");
          surface()
            .find(".cl-ui-surface-caret")
            .should("be.visible")
            .and("have.attr", "aria-hidden", "true");
          surface().should((panels) => {
            const panel = panels[0];
            const anchor = panel.ownerDocument.querySelector(
              `.shared-editor-header button[aria-label="${trigger}"]`,
            );
            const caret = panel.querySelector(".cl-ui-surface-caret");
            const body = panel.querySelector(".cl-ui-surface-content");
            const rect = panel.getBoundingClientRect();
            const target = anchor.getBoundingClientRect();
            const pointer = caret.getBoundingClientRect();
            // Wait for the opening animation before measuring alignment.
            expect(getComputedStyle(panel).transform).eq("none");
            expect(panel.dataset.caretSide).eq("top");
            expect(rect.top).closeTo(target.bottom + 12, 1);
            expect(rect.left).gte(11);
            expect(rect.right).lte(width - 11);
            expect(rect.bottom).lte(height - 11);
            expect(pointer.top).closeTo(rect.top - 8, 1);
            const center = pointer.left + pointer.width / 2;
            expect(center).gte(target.left);
            expect(center).lte(target.right);
            expect(center).closeTo(target.left + target.width / 2, 6);
            expect(getComputedStyle(panel).overflow).eq("visible");
            expect(getComputedStyle(body).overflowY).eq("auto");
            expect(getComputedStyle(caret).fill).eq(
              getComputedStyle(body).backgroundColor,
            );
          });
          surface().trigger("keydown", { key: "Escape" });
          control(trigger).should("be.focused");
        }
      }
    }
    cy.viewport(1280, 800);
    control("Choose template").click();
    cy.get('dialog[aria-label="Choose template"][open]')
      .should("not.have.class", "cl-ui-pointed")
      .find(".cl-ui-surface-caret")
      .should("not.exist");
  });

  it("distinguishes collapsible categories and Inspector sections from picker popovers", () => {
    visit();
    control("Blocks").click();
    cy.get('.block-library__heading[aria-expanded="true"]')
      .first()
      .as("category", { type: "static" });
    cy.get("@category").find(".block-library__count").should("not.be.empty");
    cy.get("@category").find(".block-library__caret").should("be.visible");
    cy.get("@category")
      .parent()
      .find("[data-library-block]")
      .should("have.length.gte", 1);
    cy.get("@category").click().should("have.attr", "aria-expanded", "false");
    cy.get("@category")
      .parent()
      .find("[data-library-block]")
      .should("not.exist");
    cy.get("@category").click().should("have.attr", "aria-expanded", "true");
    control("List view").click();
    cy.get(".outline-document-settings").click();
    cy.get("cl-dimensions-picker details")
      .as("size")
      .should("not.have.attr", "open");
    cy.get("@size")
      .find("summary")
      .should((summary) => {
        expect(getComputedStyle(summary[0], "::after").content).eq('""');
        expect(getComputedStyle(summary[0]).paddingLeft).eq("10px");
      });
    cy.get("@size").find("summary").click();
    cy.get("@size").should("have.attr", "open");
    cy.get("@size").find(".cl-picker-body").should("be.visible");
    cy.get(".theme-inspector cl-appearance-picker-panel cl-color-picker")
      .first()
      .find(".cl-picker-trigger")
      .click()
      .should("have.attr", "aria-expanded", "true");
    cy.get(".cl-picker-popover:popover-open")
      .should("be.visible")
      .find(".cl-picker-popover-heading button cl-editor-icon")
      .should("be.visible");
    cy.get(".cl-picker-popover:popover-open").trigger("keydown", {
      key: "Escape",
    });
    cy.get("@size").should("have.attr", "open");
  });

  it("uses themed prompts with focus and Escape behavior, and blocks workspace shortcuts while a modal is open", () => {
    visit();
    control("Outline").click();
    for (const mode of ["dark", "light"]) {
      if (mode === "light") control("Switch to light mode").click();
      control("Editor settings").click();
      cy.get('[aria-label="Editor settings"]:popover-open')
        .contains("button", "Save as new theme")
        .click();
      modal()
        .should("be.visible")
        .within(() => {
          cy.get(".editor-dialog-header").should(
            "contain",
            "Save as new theme",
          );
          cy.get('[aria-label="Name"]').should("be.focused");
          cy.get(".editor-dialog-footer button").should("have.length", 2);
        });
      modal()
        .should((dialog) => {
          const style = getComputedStyle(dialog[0]);
          const shell = dialog[0].closest(".shared-editor");
          expect(style.getPropertyValue("--editor-glass").trim()).eq(
            getComputedStyle(shell).getPropertyValue("--editor-glass").trim(),
          );
          expect(style.borderRadius).eq("16px");
        })
        .trigger("keydown", shortcut);
      control("Outline").should("have.attr", "aria-pressed", "true");
      modal().trigger("keydown", { key: "Escape" });
      cy.get(".editor-confirmation").should("not.have.attr", "open");
    }
  });

  it("confirms last-column removal from List, Outline, and Inspector with cancel and undo", () => {
    visit();
    cy.window().then((win) =>
      expect(win.colossalThemeEditor.canRun("remove", "controls-column")).eq(
        false,
      ),
    );
    cy.on("window:confirm", () => {
      throw new Error("The editor must use its themed confirmation modal");
    });
    const cancel = () => {
      modal()
        .should("be.visible")
        .contains("button", "Cancel")
        .should("be.focused")
        .click();
      row("controls-column").should("exist");
    };
    row("controls-column").trigger("keydown", { key: "Delete" });
    cancel();
    row("controls-column").rightclick();
    cy.get('[aria-label="Block actions"]:popover-open')
      .contains("button", "Cut")
      .click();
    cancel();
    control("Outline").click();
    row("controls-column").rightclick();
    cy.get('[aria-label="Block actions"]:popover-open')
      .contains("button", "Delete block")
      .click();
    modal().contains("button", "Remove Columns").click();
    row("controls-columns").should("not.exist");
    control("Undo").click();
    row("controls-column").should("exist");
    row("controls-column").find(".theme-node-label").click();
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get(".theme-inspector .theme-actions")
      .contains("button", /^\s*Delete\s*$/)
      .click();
    modal().contains("button", "Cancel").click();
    cy.get(".theme-inspector .theme-actions")
      .contains("button", /^\s*Delete\s*$/)
      .click();
    modal().contains("button", "Remove Columns").click();
    control("Undo").click();
    cy.get(".shared-editor").trigger("keydown", shortcut);
    row("controls-column").should("exist");
  });

  for (const kind of ["post", "page"])
    it(`supports the same List shortcut and iframe scrollbars in ${kind}s`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`Editor controls ${kind}`);
      control("Outline").click();
      canvasShortcut(".content-live-preview");
      control("List view").should("have.attr", "aria-pressed", "true");
      cy.get(".content-live-preview").should((frames) => {
        const doc = frames[0].contentDocument;
        const sidebar = frames[0].ownerDocument.querySelector(
          ".editor-sidebar-scroll",
        );
        expect(
          doc.defaultView.getComputedStyle(doc.documentElement).scrollbarColor,
        ).eq(getComputedStyle(sidebar).scrollbarColor);
      });
      control("Blocks").click();
      cy.get('[aria-label="Title"]').trigger("keydown", shortcut);
      control("Blocks").should("have.attr", "aria-pressed", "true");
    });
});
