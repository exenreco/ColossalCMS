describe("V2.0.4 theme workflows", () => {
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
  const viewport = (name) => {
    control("Viewport").click();
    cy.get('dialog[aria-label="Viewport options"]:popover-open')
      .contains("button", name)
      .click();
  };
  const publish = () => {
    control("Editor settings").click();
    cy.get(
      'dialog[aria-label="Editor settings"]:popover-open .editor-publish',
    ).click();
  };
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
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers: { Origin: "http://127.0.0.1:4201" },
      body: { walkthroughVersion: 1 },
    });
  });
  it("shows every standard template in the Theme Editor", () => {
    cy.visit("/admin/themes/edit/" + core);
    control("Choose template").click();
    cy.get(".editor-template-card[data-template-id] span").then((options) => {
      const names = [...options].map((option) => option.textContent.trim());
      for (const name of ["Home", "Page", "Posts", "Single", "Search", "404"])
        expect(names).to.include(name);
    });
    cy.get('.editor-template-card[data-template-id="home"]').click();
    cy.get(".theme-editor").should("have.attr", "data-template-id", "home");
    chooseTemplate("not-found");
    cy.get(".theme-editor").should(
      "have.attr",
      "data-template-id",
      "not-found",
    );
  });
  it("installs, edits with drag and drop, saves a draft and publishes the active theme", () => {
    cy.visit("/admin/themes/edit/" + core);
    cy.get(".theme-editor").should("be.visible");
    cy.reload();
    cy.get(".theme-editor").should("be.visible");
    control("Back to workspace").click();
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
    chooseTemplate("post-archive");
    control("Outline").click();
    cy.get('[aria-label="Add top-level block"]').click();
    cy.get('[aria-label="Find a block to insert"]').type("Heading");
    cy.get(".outline-insert-options")
      .contains("button", /^Heading$/)
      .click();
    inspector();
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("A theme built from blocks");
    control("Save draft").click();
    cy.contains("Draft saved").should("exist");
    cy.request("/api/themes/render?path=/")
      .its("body.html")
      .should("not.contain", "A theme built from blocks");
    publish();
    cy.contains("Theme published").should("exist");
    cy.contains("v1.0.1").should("exist");
    cy.get(".theme-live-preview").should("be.visible");
    viewport("Mobile");
    cy.get(".theme-live-preview").should("have.css", "width", "390px");
    cy.screenshot("theme-editor-mobile-preview", { capture: "viewport" });
    viewport("Tablet");
    cy.get(".theme-live-preview").should("have.css", "width", "768px");
    cy.screenshot("theme-editor-tablet-preview", { capture: "viewport" });
    viewport("Desktop");
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
    inspector();
    cy.contains("summary", "Template").click();
    cy.contains(".editor-option-panel", "Template")
      .find("select")
      .select("full-width");
    publish();
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
    inspector();
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
        chooseTemplate("default");
        control("Outline").click();
        const root = ".theme-outline .outline-tree > cl-theme-block-tree";
        const typesIn = (tree) =>
          [...tree[0].children]
            .filter((el) => el.matches("cl-theme-block-tree"))
            .map((el) =>
              el
                .querySelector(":scope > .theme-tree-node")
                ?.getAttribute("data-block-type"),
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
          cy.get(".theme-editor-viewport").should(
            "not.have.class",
            "is-dragging",
          );
        };
        cy.get(root)
          .should((tree) => {
            const types = typesIn(tree);
            expect(types[0]).eq("theme/part-header");
            expect(types.at(-1)).eq("theme/part-footer");
          })
          .then((tree) =>
            dragTo("theme/part-header", typesIn(tree).length, 10),
          );
        cy.get(root)
          .should((tree) => {
            expect(typesIn(tree).at(-1)).eq("theme/part-header");
          })
          .then(() => dragTo("theme/part-footer", 0, 11));
        cy.get(root).should((tree) => {
          const types = typesIn(tree);
          expect(types[0]).eq("theme/part-footer");
          expect(types.at(-1)).eq("theme/part-header");
        });
        control("Save draft").click();
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
  it("edits a shared part with undo and redo while keeping its document root protected", () => {
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
        control("Outline").click();
        cy.get('[data-block-type="theme/part-header"]')
          .find(".theme-tree-row")
          .should("have.attr", "draggable", "false");
        inspector();
        cy.get(".theme-parts").contains("button", "header").click();
        cy.contains("Editing shared header").should("be.visible");
        cy.get(".blocks-trigger").then((button) => {
          if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
        });
        cy.get('[data-library-block="core/heading"]').click();
        inspector();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .clear()
          .type("Shared greeting");
        control("Undo").click();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .should("not.have.value", "Shared greeting");
        control("Redo").click();
        cy.get(".theme-inspector")
          .contains("label", "Text")
          .find("input")
          .should("have.value", "Shared greeting");
        cy.get(
          '.contextual-block-toolbar [aria-label="Duplicate block"]',
        ).click();
        cy.get('.contextual-block-toolbar [aria-label="Delete block"]').click();
        control("Save draft").click();
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
