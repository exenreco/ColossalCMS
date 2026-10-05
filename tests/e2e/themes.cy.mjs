describe("V2.0.4 theme workflows", () => {
  const core = "com.colossal.theme.default";
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      failOnStatusCode: false,
      headers: { Origin: "http://127.0.0.1:4201" },
    })
      .its("status")
      .should("be.oneOf", [200, 409]);
  });
  it("shows every standard template in the Theme Editor", () => {
    cy.visit("/admin/themes/edit/" + core);
    cy.get('[aria-label="Template to edit"] option').then((options) => {
      const names = [...options].map((option) => option.textContent.trim());
      for (const name of ["Home", "Page", "Posts", "Single", "Search", "404"])
        expect(names).to.include(name);
    });
    cy.get('[aria-label="Template to edit"]').select("home");
    cy.get('[aria-label="Template to edit"]').should("have.value", "home");
    cy.get('[aria-label="Template to edit"]').select("not-found");
    cy.get('[aria-label="Template to edit"]').should("have.value", "not-found");
  });
  it("installs, edits with drag and drop, saves a draft and publishes the active theme", () => {
    cy.visit("/admin/themes/edit/" + core);
    cy.get(".theme-editor").should("be.visible");
    cy.reload();
    cy.get(".theme-editor").should("be.visible");
    cy.get(".theme-editor-header").contains("button", "Back").click();
    cy.get('nav[aria-label="Main navigation"]')
      .should("contain", "Settings")
      .and("not.contain", "Themes");
    cy.get('nav[aria-label="System navigation"]')
      .should("contain", "Themes")
      .and("contain", "Plugins");
    cy.get("input[type=file]").selectFile("tests/fixtures/theme-sample.zip", {
      force: true,
    });
    cy.contains(".theme-card", "Meadow")
      .should("be.visible")
      .within(() => {
        cy.contains("button", "Activate").click();
      });
    cy.contains(".theme-card", "Meadow")
      .should("contain", "Active theme")
      .within(() => {
        cy.contains("a", "Edit theme").click();
      });
    cy.get(".theme-editor").should("be.visible");
    cy.get('[aria-label="Template to edit"]').select("post-archive");
    cy.get('[role="radio"][aria-label="Outline"]').click();
    cy.get(".blocks-trigger").then((button) => {
      if (button.attr("aria-expanded") !== "true") cy.wrap(button).click();
    });
    const transfer = new DataTransfer();
    cy.get('[data-library-block="core/heading"]').trigger("dragstart", {
      dataTransfer: transfer,
    });
    cy.get(
      ".theme-outline > cl-theme-block-tree > .theme-tree-node > .theme-tree-children > .theme-drop-zone",
    )
      .last()
      .trigger("dragover", { dataTransfer: transfer })
      .trigger("drop", { dataTransfer: transfer });
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("A theme built from blocks");
    cy.get(".theme-more summary").click();
    cy.get(".theme-more").contains("button", "Save Draft").click();
    cy.get(".theme-more summary").click();
    cy.contains("Draft saved").should("exist");
    cy.request("/api/themes/render?path=/")
      .its("body.html")
      .should("not.contain", "A theme built from blocks");
    cy.get(".theme-editor-header").contains("button", "Publish").click();
    cy.contains("Published version").should("exist");
    cy.contains("v1.0.1").should("exist");
    cy.get('[role="radio"][aria-label="Canvas"]').click();
    cy.get('[aria-label="Mobile preview"]').click();
    cy.get(".theme-live-preview").should("have.css", "width", "390px");
    cy.screenshot("theme-editor-mobile-preview", { capture: "viewport" });
    cy.get('[aria-label="Tablet preview"]').click();
    cy.get(".theme-live-preview").should("have.css", "width", "768px");
    cy.screenshot("theme-editor-tablet-preview", { capture: "viewport" });
    cy.get('[aria-label="Desktop preview"]').click();
    cy.get(".theme-live-preview").should("have.css", "width", "1200px");
    cy.screenshot("theme-editor-desktop-preview", { capture: "viewport" });
    cy.visit("/");
    cy.get(".theme-root")
      .should("contain", "Meadow stories")
      .and("contain", "A theme built from blocks");
  });
  it("persists a page template override and warns when activation needs a fallback", () => {
    cy.request("/api/themes/" + core).then(({ body }) =>
      cy.request({
        method: "POST",
        url: "/api/themes/" + core + "/activate",
        body: { revision: body.revision },
        headers: { Origin: "http://127.0.0.1:4201" },
      }),
    );
    cy.visit("/admin/pages");
    cy.contains("button", "About us").click();
    cy.contains("summary", "Template").click();
    cy.contains(".editor-option-panel", "Template")
      .find("select")
      .select("full-width");
    cy.get(".content-editor-fullscreen")
      .contains("button", /Update|Publish/)
      .click();
    cy.request("/api/themes/render?path=/about")
      .its("body.templateId")
      .should("eq", "full-width");
    cy.visit("/admin/themes");
    cy.on("window:confirm", (text) => {
      expect(text).to.contain("fallback template");
      expect(text).to.contain("About us");
      return true;
    });
    cy.contains(".theme-card", "Meadow").contains("button", "Activate").click();
    cy.request("/api/themes/render?path=/about")
      .its("body.templateId")
      .should("eq", "default-2");
    cy.visit("/admin/pages");
    cy.contains("button", "About us").click();
    cy.contains("summary", "Template").click();
    cy.contains("which is not available in the active theme").should("exist");
    cy.request("/api/themes/" + core).then(({ body }) =>
      cy.request({
        method: "POST",
        url: "/api/themes/" + core + "/activate",
        body: { revision: body.revision },
        headers: { Origin: "http://127.0.0.1:4201" },
      }),
    );
  });
  it("moves Header and Footer shared parts in the Outline and saves their new order", () => {
    cy.request("/api/themes/" + core)
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + core + "/clone",
          body: { revision: body.revision, name: "Shared part ordering test" },
          headers: { Origin: "http://127.0.0.1:4201" },
        }),
      )
      .then(({ body }) => {
        const id = body.id;
        cy.visit("/admin/themes/edit/" + id);
        cy.get('[aria-label="Template to edit"]').select("default");
        cy.get('[role="radio"][aria-label="Outline"]').click();
        const root =
          ".theme-outline > cl-theme-block-tree > .theme-tree-node > .theme-tree-children";
        const order = () =>
          cy
            .get(root)
            .then((tree) =>
              [...tree[0].children]
                .filter((el) => el.matches("cl-theme-block-tree"))
                .map((el) =>
                  el
                    .querySelector(":scope > .theme-tree-node")
                    ?.getAttribute("data-block-type"),
                ),
            );
        const dragTo = (type, index, pointerId) => {
          cy.get(`${root} > .theme-drop-zone[data-drop-index="${index}"]`)
            .scrollIntoView()
            .then((zone) => {
              const doc = zone[0].ownerDocument;
              const source = doc.querySelector(
                `${root} > cl-theme-block-tree > .theme-tree-node[data-block-type="${type}"] > .theme-tree-row`,
              );
              expect(source).not.eq(null);
              expect(source.getAttribute("draggable")).eq("false");
              const bounds = source.getBoundingClientRect();
              source.dispatchEvent(
                new doc.defaultView.PointerEvent("pointerdown", {
                  bubbles: true,
                  cancelable: true,
                  pointerId,
                  pointerType: "mouse",
                  button: 0,
                  buttons: 1,
                  clientX: bounds.left + 8,
                  clientY: bounds.top + 8,
                }),
              );
              const rect = zone[0].getBoundingClientRect();
              const point = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
              };
              expect(
                doc
                  .elementFromPoint(point.clientX, point.clientY)
                  ?.closest(".theme-drop-zone,.theme-tree-row"),
              ).eq(zone[0]);
              for (const name of ["pointermove", "pointerup"])
                doc.dispatchEvent(
                  new doc.defaultView.PointerEvent(name, {
                    bubbles: true,
                    cancelable: true,
                    pointerId,
                    pointerType: "mouse",
                    button: 0,
                    buttons: name === "pointerup" ? 0 : 1,
                    ...point,
                  }),
                );
            });
          cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
        };
        order().then((types) => {
          expect(types[0]).eq("theme/part-header");
          expect(types.at(-1)).eq("theme/part-footer");
          dragTo("theme/part-header", types.length, 10);
        });
        order().then((types) => {
          expect(types.at(-1)).eq("theme/part-header");
          dragTo("theme/part-footer", 0, 11);
        });
        order().then((types) => {
          expect(types[0]).eq("theme/part-footer");
          expect(types.at(-1)).eq("theme/part-header");
        });
        cy.get(".theme-more summary").click();
        cy.get(".theme-more").contains("button", "Save Draft").click();
        cy.contains("Draft saved").should("exist");
        cy.request("/api/themes/" + id).then(({ body: record }) => {
          const types = record.draft.templates.default.children.map(
            (block) => block.type,
          );
          expect(types[0]).eq("theme/part-footer");
          expect(types.at(-1)).eq("theme/part-header");
        });
      });
  });
  it("edits a shared part with undo and redo while keeping it protected from deletion", () => {
    cy.request("/api/themes/" + core)
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + core + "/clone",
          body: { revision: body.revision, name: "Shared parts test" },
          headers: { Origin: "http://127.0.0.1:4201" },
        }),
      )
      .then(({ body }) => {
        const id = body.id;
        cy.visit("/admin/themes/edit/" + id);
        cy.get('[role="radio"][aria-label="Outline"]').click();
        cy.get('[data-block-type="theme/part-header"]')
          .find(".theme-tree-row")
          .should("have.attr", "draggable", "false");
        cy.get(".theme-parts").contains("button", "header").click();
        cy.contains("Editing shared header").should("be.visible");
        cy.get(".blocks-trigger").then((button) => {
          if (button.attr("aria-expanded") !== "true") cy.wrap(button).click();
        });
        cy.get('[data-library-block="core/heading"]').click();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .clear()
          .type("Shared greeting");
        cy.get(".theme-editor-subbar")
          .find('button[aria-label="Undo"]')
          .click();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .should("not.have.value", "Shared greeting");
        cy.get(".theme-editor-subbar")
          .find('button[aria-label="Redo"]')
          .click();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .should("have.value", "Shared greeting");
        cy.get(".theme-inspector").contains("button", "Duplicate").click();
        cy.get(".theme-inspector").contains("button", "Delete").click();
        cy.get(".theme-more summary").click();
        cy.get(".theme-more").contains("button", "Save Draft").click();
        cy.get(".theme-more summary").click();
        cy.contains("Draft saved").should("exist");
        cy.request("/api/themes/" + id).then(({ body: record }) => {
          expect(record.draft.compiled.default).to.contain("Shared greeting");
          expect(record.draft.compiled["post-single"]).to.contain(
            "Shared greeting",
          );
          expect(record.published.compiled.default).not.to.contain(
            "Shared greeting",
          );
        });
        cy.get(".theme-part-banner").contains("button", "Template").click();
        cy.screenshot("theme-editor-outline", { capture: "viewport" });
      });
  });
});
