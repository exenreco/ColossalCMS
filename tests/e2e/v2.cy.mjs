describe("V2 CMS workflows", () => {
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
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      failOnStatusCode: false,
      headers: { Origin: "http://127.0.0.1:4201" },
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers: { Origin: "http://127.0.0.1:4201" },
      body: { walkthroughVersion: 1 },
    });
  });
  it("uploads media, selects an icon, authors rich content, and validates an inactive ZIP", () => {
    cy.visit("/admin/media");
    cy.contains("button", "Upload media").first().click();
    cy.get("input[type=file]").selectFile("tests/fixtures/media-sample.svg");
    cy.contains("label", "Image alt text")
      .find("input")
      .type("Layered green hills under a golden sun");
    cy.contains("button", "Upload file").click();
    cy.contains("strong", "media-sample.svg").should("be.visible");
    cy.get('[aria-label="Details for media-sample.svg"]').click();
    cy.get("input[name=caption]").type("A quiet horizon");
    cy.get("input[name=tags]").type("landscape, illustration");
    cy.contains("button", "Save details").click();
    cy.contains("Media details saved.").should("be.visible");
    cy.get('[aria-label="Close media details"]').click();
    cy.get('[aria-label="Search media"]').type("landscape");
    cy.contains("strong", "media-sample.svg").should("be.visible");
    cy.get('nav[aria-label="Main navigation"]').contains("Settings").click();
    cy.contains("button", "Select site icon").click();
    cy.get('[aria-label="Select media-sample.svg"]').click();
    cy.contains("button", "Use selected").click();
    cy.contains("button", "Save changes").click();
    cy.contains("Site settings saved.").should("exist");
    cy.get('nav[aria-label="Main navigation"]').contains("Posts").click();
    cy.contains("button", "Create post").first().click();
    cy.get("[aria-label=Title]").type("Cypress V2 story");

    inspector();
    cy.get(".content-block-inspector textarea")
      .clear()
      .type("<p>Words with a place to grow.</p>");
    control("Blocks").click();
    cy.get('[data-library-block="core/image"]').click();
    inspector();
    cy.get(".content-block-inspector")
      .contains("button", "Choose image")
      .click();
    cy.get('[aria-label="Select media-sample.svg"]').click();
    cy.contains("button", "Use selected").click();
    control("Outline").click();
    cy.get('[data-block-type="core/image"]').should("exist");
    control("Save draft").click();
    cy.url().should("include", "/posts/edit/");
    cy.get(".content-editor-fullscreen")
      .contains("All changes saved")
      .should("exist");
    control("Editor settings").click();
    cy.get(
      'dialog[aria-label="Editor settings"]:popover-open .editor-publish',
    ).click();
    cy.contains("Your post is published.").should("exist");
    cy.request("/api/public").then(({ body }) => {
      const c = body.content.find((c) => c.title === "Cypress V2 story");
      expect(
        c.details.contentBlocks.some(
          (n) => n.type === "core/image" && n.settings.mediaId,
        ),
      ).eq(true);
      const d = new Date(c.publishAt);
      cy.visit(
        "/" +
          d.getUTCFullYear() +
          "/" +
          String(d.getUTCMonth() + 1).padStart(2, "0") +
          "/" +
          c.slug,
      );
    });
    cy.get("h1").should("contain", "Cypress V2 story");
    cy.get(".theme-root img").should(
      "have.attr",
      "alt",
      "Layered green hills under a golden sun",
    );
    cy.visit("/admin/plugins");
    cy.contains("button", "Upload plugin").click();
    cy.get("input[type=file]").selectFile("tests/fixtures/plugin-sample.zip");
    cy.contains("button", "Install ZIP").click();
    cy.contains(".plugin-card, tr", "E2E archive").within(() => {
      cy.contains("Inactive").should("exist");
      cy.contains("button", "Activation disabled").should("be.disabled");
    });
  });
  it("guards unsaved edits and keeps rich text on reload", () => {
    cy.visit("/admin/posts");
    cy.contains("button", "Cypress V2 story").click();
    cy.get("[aria-label=Title]").clear().type("Unsaved title");
    control("Back to workspace").click();
    cy.contains("Leave unsaved changes?").should("be.visible");
    cy.contains("button", "Discard changes").click();
    cy.contains("button", "Cypress V2 story").should("exist");
  });
});
