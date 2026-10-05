describe("V2.0.4 toolbar and drawers", () => {
  let themeId;
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get('.theme-editor-subbar [aria-label="' + name + '"]');
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "Toolbar test" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        cy.visit("/admin/themes/edit/" + themeId, {
          onBeforeLoad(win) {
            win.sessionStorage.setItem("colossal.block-library.open", "false");
            win.sessionStorage.setItem("colossal.inspector.open", "true");
          },
        });
      });
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".theme-live-preview").should((frame) =>
      expect(frame[0].contentDocument.querySelector(".theme-root")).not.eq(
        null,
      ),
    );
  });
  it("anchors two regions in DOM order at all specified desktop widths", () => {
    for (const width of [1280, 1440, 1920]) {
      cy.viewport(width, 900);
      cy.get(".theme-editor-subbar").should((bar) => {
        const controls = [...bar[0].querySelectorAll("button")];
        expect(controls.map((b) => b.getAttribute("aria-label"))).deep.eq([
          "Blocks",
          "Block list",
          "Canvas",
          "Outline",
          "Undo",
          "Redo",
          "Desktop preview",
          "Tablet preview",
          "Mobile preview",
        ]);
        const rect = bar[0].getBoundingClientRect(),
          style = getComputedStyle(bar[0]);
        expect(controls[0].getBoundingClientRect().left).closeTo(
          rect.left + parseFloat(style.paddingLeft),
          1,
        );
        // The segment border and its 2px inset enclose the trailing radio.
        const right = bar[0]
          .querySelector(".cl-editor-secondary-toolbar__region--right")
          .getBoundingClientRect();
        expect(right.right).closeTo(
          rect.right - parseFloat(style.paddingRight),
          1,
        );
        expect(controls.at(-1).getBoundingClientRect().right).closeTo(
          right.right - 3,
          1,
        );
        controls.forEach((button, i) => {
          expect(button.title).not.eq("");
          expect(button.getBoundingClientRect().width).gte(32);
          expect(button.getBoundingClientRect().height).gte(32);
          if (i)
            expect(button.getBoundingClientRect().left).gte(
              controls[i - 1].getBoundingClientRect().right,
            );
        });
      });
      cy.get(".toolbar-right").should((el) => {
        expect(
          [...el[0].children].map((c) =>
            (c.querySelector("summary") || c).textContent.trim(),
          ),
        ).deep.eq(["Preview", "Publish", "···"]);
      });
      cy.get(".toolbar-center").should((el) => {
        const rect = el[0].getBoundingClientRect();
        const header = el[0]
          .closest(".theme-editor-header")
          .getBoundingClientRect();
        expect(rect.left + rect.width / 2).closeTo(
          header.left + header.width / 2,
          1,
        );
      });
      cy.screenshot("toolbar-" + width, { capture: "viewport", scale: true });
    }
  });
  it("starts on Home and edits the current canvas through the block list", () => {
    cy.get('[aria-label="Template to edit"]').should("have.value", "home");
    control("Block list").click();
    cy.get("#block-list-drawer").should("be.visible");
    cy.get("#block-list-drawer .block-list-tree").should("contain", "Body");
    cy.get("#block-list-drawer [data-block-type='core/heading']").then(
      (rows) => {
        const count = rows.length;
        cy.wrap(rows[0]).find(".theme-tree-row").first().rightclick();
        cy.get('[aria-label="Block actions"]')
          .contains("button", "Duplicate")
          .click();
        cy.get("#block-list-drawer [data-block-type='core/heading']").should(
          "have.length",
          count + 1,
        );
        cy.get("#block-list-drawer [data-block-type='core/heading']")
          .last()
          .find(".theme-tree-row")
          .first()
          .rightclick();
        cy.get('[aria-label="Block actions"]')
          .contains("button", "Cut")
          .click();
        cy.get("#block-list-drawer [data-block-type='core/heading']").should(
          "have.length",
          count,
        );
        cy.get("#block-list-drawer [data-block-type='core/heading']")
          .first()
          .find(".theme-tree-row")
          .first()
          .rightclick();
        cy.get('[aria-label="Block actions"]')
          .contains("button", "Paste after")
          .click();
        cy.get("#block-list-drawer [data-block-type='core/heading']").should(
          "have.length",
          count + 1,
        );
      },
    );
    const transfer = new DataTransfer();
    cy.get("#block-list-drawer [data-block-type='core/heading']")
      .first()
      .find(".theme-tree-row")
      .first()
      .trigger("dragstart", { dataTransfer: transfer });
    cy.get(
      "#block-list-drawer .block-list-tree > cl-theme-block-tree > .theme-tree-node > .theme-tree-children > .theme-drop-zone",
    )
      .last()
      .trigger("dragover", { dataTransfer: transfer })
      .trigger("drop", { dataTransfer: transfer });
    cy.get(
      "#block-list-drawer .block-list-tree > cl-theme-block-tree > .theme-tree-node > .theme-tree-children > cl-theme-block-tree > .theme-tree-node",
    )
      .last()
      .should("have.attr", "data-block-type", "core/heading");
    control("Blocks").click();
    control("Block list").should("have.attr", "aria-expanded", "false");
    cy.get("#block-library-drawer").should("be.visible");
  });
  it("keeps the shared part open after publishing", () => {
    cy.get(".theme-parts").contains("button", "header").click();
    cy.contains("Editing shared header").should("be.visible");
    control("Blocks").click();
    cy.get('[data-library-block="core/heading"]').first().click();
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("Published shared header");
    cy.on("window:confirm", () => true);
    cy.get(".theme-editor-header").contains("button", "Publish").click();
    cy.contains("Editing shared header").should("be.visible");
    cy.get('[aria-label="Template to edit"]').should("have.value", "home");
    control("Block list").click();
    cy.get("#block-list-drawer").should("contain", "Published shared header");
  });
  it("pushes by the drawer width, persists state and scroll, and overlays below 1200px", () => {
    let before;
    cy.get(".theme-workspace").then((el) => {
      before = el[0].getBoundingClientRect().left;
    });
    control("Blocks").click();
    cy.get(".theme-workspace").should((el) =>
      expect(el[0].getBoundingClientRect().left - before).closeTo(320, 1),
    );
    cy.get(".theme-library-drawer").should((el) =>
      expect(el[0].getBoundingClientRect().width).eq(320),
    );
    cy.get(".block-library").scrollTo(0, 180);
    cy.window().should((win) =>
      expect(win.sessionStorage.getItem("colossal.block-library.scroll")).eq(
        "180",
      ),
    );
    cy.reload();
    control("Blocks").should("have.attr", "aria-expanded", "true");
    cy.get(".block-library").should((el) => expect(el[0].scrollTop).eq(180));
    cy.get(".theme-live-preview").should((frame) =>
      expect(frame[0].contentDocument.querySelector(".theme-root")).not.eq(
        null,
      ),
    );
    cy.screenshot("toolbar-both-drawers", { capture: "viewport", scale: true });
    cy.get("body").trigger("keydown", { key: "Escape", force: true });
    control("Blocks")
      .should("have.focus")
      .and("have.attr", "aria-expanded", "false");
    cy.get(".theme-workspace").should((el) =>
      expect(el[0].getBoundingClientRect().left).closeTo(before, 1),
    );
    cy.viewport(900, 800);
    control("Blocks").click();
    cy.get(".drawer-scrim").should("be.visible");
    cy.get(".theme-workspace").should((el) =>
      expect(el[0].getBoundingClientRect().left).eq(0),
    );
    cy.screenshot("toolbar-overlay", { capture: "viewport", scale: true });
    cy.get(".drawer-scrim").click("right");
    control("Blocks").should("have.attr", "aria-expanded", "false");
  });
  it("supports roving focus, native tab order and editor shortcuts without stealing text editing", () => {
    control("Undo").should("be.disabled");
    control("Redo").should("be.disabled");
    control("Blocks").click();
    cy.get('[data-library-block="core/heading"]').first().click();
    cy.get('[data-library-block="core/spacer"]').first().click();
    control("Undo").click();
    control("Redo").should("not.be.disabled");
    control("Blocks").click().focus();
    for (const label of [
      "Block list",
      "Canvas",
      "Undo",
      "Redo",
      "Desktop preview",
    ]) {
      cy.press(Cypress.Keyboard.Keys.TAB);
      control(label).should("have.focus");
    }
    cy.press(Cypress.Keyboard.Keys.RIGHT);
    control("Tablet preview")
      .should("have.focus")
      .and("have.attr", "aria-checked", "true");
    cy.get(".theme-live-preview").should("have.css", "width", "768px");
    cy.press(Cypress.Keyboard.Keys.END);
    cy.get(".theme-live-preview").should("have.css", "width", "390px");
    control("Canvas").focus();
    cy.press(Cypress.Keyboard.Keys.RIGHT);
    control("Outline").should("have.focus").and("have.attr", "tabindex", "0");
    cy.get(".theme-outline").should("be.visible");
    cy.get("body").trigger("keydown", {
      force: true,
      key: "C",
      ctrlKey: true,
      shiftKey: true,
    });
    cy.get(".theme-live-preview").should("exist");
    cy.get("body").trigger("keydown", { key: "1", metaKey: true, force: true });
    cy.get(".theme-live-preview").should("have.css", "width", "1200px");
    cy.get("body").trigger("keydown", { key: "b", ctrlKey: true, force: true });
    cy.get(".block-library__search")
      .should("have.focus")
      .trigger("keydown", { key: "3", ctrlKey: true });
    control("Desktop preview").should("have.attr", "aria-checked", "true");
    cy.get("body").trigger("keydown", { key: "Escape", force: true });
    cy.get('[role="radiogroup"]').each((group) => {
      expect(group.find('[role="radio"][tabindex="0"]')).to.have.length(1);
    });
  });
});
