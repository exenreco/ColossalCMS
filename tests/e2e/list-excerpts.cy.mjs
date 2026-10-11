Cypress.Commands.addQuery(
  "resultExcerpts",
  function (frame = ".theme-live-preview") {
    return () =>
      Cypress.$(
        cy
          .state("document")
          .querySelector(frame)
          ?.contentDocument?.querySelectorAll(".theme-post-excerpt") || [],
      );
  },
);

describe("Inspector excerpt controls", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  let themeId;
  beforeEach(() => {
    cy.intercept("PUT", "/api/themes/*/draft").as("themeDraft");
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
          body: { revision: body.revision, name: "Excerpt controls fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.draft || body.published;
        for (const id of ["post-archive", "search"])
          document.templates[id].children = [
            {
              id: "blk_excerpt_results",
              type: "core/post-list",
              settings: {},
              children: [
                { id: "blk_excerpt_child", type: "core/excerpt", settings: {} },
              ],
            },
          ];
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  const selectResults = (id) => {
    control("Choose template").click();
    cy.get(
      `dialog[aria-label="Choose template"][open] [data-template-id="${id}"]`,
    ).click();
    control("List view").then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get(
      '[data-outline-id="blk_excerpt_child"] > .theme-tree-row .theme-node-label',
    ).click();
    inspector();
  };
  for (const id of ["post-archive", "search"])
    it(`changes and persists excerpts in ${id === "search" ? "search results" : "post lists"}`, () => {
      cy.visit("/admin/themes/edit/" + themeId);
      selectResults(id);
      cy.get(".theme-inspector")
        .contains("label", "Show excerpt")
        .find("input")
        .should("be.checked");
      cy.get(".theme-inspector")
        .contains("label", "Excerpt word limit")
        .find("input")
        .should("have.value", "0")
        .clear()
        .type("2");
      cy.resultExcerpts().should((excerpts) => {
        expect(excerpts.length).to.be.greaterThan(0);
        [...excerpts].forEach((excerpt) =>
          expect(excerpt.textContent.trim().split(/\s+/)).to.have.length(2),
        );
      });
      cy.get(".theme-inspector")
        .contains("label", "Show excerpt")
        .find("input")
        .uncheck();
      cy.resultExcerpts().should("have.length", 0);
      control("Save draft").click();
      cy.wait("@themeDraft");
      cy.request("/api/themes/" + themeId).then(({ body }) => {
        const settings =
          body.draft.templates[id].children[0].children[0].settings;
        expect(settings.showExcerpt).eq(false);
        expect(Number(settings.excerptLength)).eq(2);
        const other =
          body.draft.templates[id === "search" ? "post-archive" : "search"]
            .children[0].children[0].settings;
        expect(other.showExcerpt).eq(undefined);
      });
      cy.reload();
      selectResults(id);
      cy.get(".theme-inspector")
        .contains("label", "Show excerpt")
        .find("input")
        .should("not.be.checked")
        .check();
      cy.resultExcerpts()
        .should("have.length.at.least", 1)
        .each((excerpt) => expect(excerpt.text()).to.match(/…$/));
    });
  for (const kind of ["post", "page"])
    it(`provides excerpt controls for a list added to ${kind} content`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('[aria-label="Title"]').type(`List excerpt ${kind}`);
      control("Blocks").click();
      cy.get('[data-library-block="core/post-list"]').click();
      control("List view").click();
      cy.get(".block-list-view")
        .contains(".theme-node-label", "Excerpt")
        .click();
      inspector();
      cy.get(".content-block-inspector")
        .contains("label", "Excerpt word limit")
        .find("input")
        .clear()
        .type("3");
      cy.resultExcerpts(".content-live-preview").should((excerpts) => {
        expect(excerpts.length).to.be.greaterThan(0);
        [...excerpts].forEach((excerpt) =>
          expect(excerpt.textContent.trim().split(/\s+/)).to.have.length(3),
        );
      });
      cy.get(".content-block-inspector")
        .contains("label", "Show excerpt")
        .find("input")
        .uncheck();
      cy.resultExcerpts(".content-live-preview").should("have.length", 0);
      control("Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (item) => item.title === `List excerpt ${kind}`,
        );
        const settings = entry.details.contentBlocks
          .find((block) => block.type === "core/post-list")
          .children.find((block) => block.type === "core/excerpt").settings;
        expect(Number(settings.excerptLength)).eq(3);
        expect(settings.showExcerpt).eq(false);
      });
    });
});
