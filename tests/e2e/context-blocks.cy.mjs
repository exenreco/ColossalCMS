Cypress.Commands.addQuery(
  "contextCanvas",
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
describe("Site and result context blocks", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  const block = (id, type, settings = {}, children) => ({
    id: "blk_" + id,
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const row = (id) => cy.get(`[data-outline-id="blk_${id}"] > .theme-tree-row`);
  let themeId;
  let featuredImageId;
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
    cy.visit("/admin/media");
    cy.contains("button", "Upload media").first().click();
    cy.get("input[type=file]").selectFile("tests/fixtures/media-sample.svg");
    cy.contains("label", "Image alt text")
      .find("input")
      .type("Result featured illustration");
    cy.contains("button", "Upload file").click();
    cy.contains("strong", "media-sample.svg").should("be.visible");
    cy.request("/api/admin/state").then(({ body }) => {
      featuredImageId = body.media.find(
        (item) => item.altText === "Result featured illustration",
      ).id;
      for (const letter of ["A", "B", "C"])
        cy.request({
          method: "POST",
          url: "/api/admin/content",
          headers,
          body: {
            kind: "post",
            title: "Context story " + letter,
            slug: "context-story-" + letter.toLowerCase(),
            excerpt: "One two three four five",
            body: "Context fixture",
            status: "published",
            details: { featuredImageId, categories: ["context-fixture"] },
          },
        });
    });
  });
  beforeEach(() => {
    cy.intercept("PUT", "/api/themes/*/draft").as("themeDraft");
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/" + body.id + "/clone",
          headers,
          body: { revision: body.revision, name: "Context blocks fixture" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.published;
        document.templates.home.children = [
          block("identity_fixture", "core/site-brand", {
            display: "name",
            level: "h2",
          }),
          block(
            "list_fixture",
            "core/post-list",
            {
              limit: 2,
              category: "context-fixture",
              orderBy: "title",
              order: "ascending",
            },
            [
              block("card_fixture", "core/container", {}, [
                block("image_fixture", "core/featured-image", {
                  aspectRatio: "16/9",
                  objectFit: "cover",
                }),
                block("title_fixture", "core/title", {
                  level: "h3",
                  linkToContent: true,
                  fontSize: 28,
                }),
                block("excerpt_fixture", "core/excerpt", { excerptLength: 3 }),
                block("copy_fixture", "core/paragraph", {
                  html: "Shared card note",
                }),
              ]),
              block("pager_wrapper", "core/row", { gap: 12 }, [
                block("pager_fixture", "core/pagination", { style: "numbers" }),
              ]),
            ],
          ),
        ];
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  it("selects any repeated Title, applies appearance to every result and keeps titles read-only", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.contextCanvas(".theme-content-title")
      .should("have.length", 2)
      .last()
      .click();
    cy.get(".theme-inspector")
      .contains("label", /^Text$/)
      .should("not.exist");
    cy.get(".theme-inspector textarea").should("not.exist");
    cy.get(".theme-inspector")
      .contains("label", "Heading level")
      .find("select")
      .select("h4");
    cy.contextCanvas(".theme-content-title").should((items) => {
      expect(items.length).eq(2);
      [...items].forEach((item) => {
        expect(item.tagName).eq("H4");
        expect(item.isContentEditable).eq(false);
        expect(
          item.ownerDocument.defaultView.getComputedStyle(item).fontSize,
        ).eq("28px");
      });
    });
    control("List view").click();
    row("title_fixture").should("have.attr", "aria-selected", "true");
    cy.contextCanvas(".theme-pagination")
      .should("have.length", 1)
      .and("contain", "Page 1 of 2");
    cy.contextCanvas('[data-source-block-id="blk_image_fixture"] img')
      .should("have.length", 2)
      .and("have.attr", "alt", "Result featured illustration");
    control("Save draft").click();
    cy.wait("@themeDraft");
    cy.request("/api/themes/" + themeId).then(({ body }) =>
      expect(
        body.draft.templates.home.children[1].children[0].children[1].settings
          .level,
      ).eq("h4"),
    );
  });
  it("edits repeated Paragraphs and preserves result layout nesting through save and reload", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    cy.contextCanvas(
      '[data-source-block-id="blk_copy_fixture"] [data-paragraph-editor]',
    )
      .should("have.length", 2)
      .last()
      .type("{selectall}Updated shared note");
    control("Save draft").click();
    cy.wait("@themeDraft");
    cy.reload();
    cy.contextCanvas('[data-source-block-id="blk_copy_fixture"] p')
      .should("have.length", 2)
      .each((item) => expect(item.text()).eq("Updated shared note"));
    control("List view").then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    row("title_fixture").rightclick();
    cy.get('[aria-label="Block actions"]:popover-open')
      .contains("button", "Duplicate")
      .click();
    cy.contextCanvas(".theme-content-title").should("have.length", 4);
    control("Save draft").click();
    cy.wait("@themeDraft");
  });
  it("exposes Site identity modes and prevents moving Pagination into Body", () => {
    cy.visit("/admin/themes/edit/" + themeId);
    row("identity_fixture").find(".theme-node-label").click();
    inspector();
    cy.get(".theme-inspector")
      .contains("label", "Display")
      .find("select")
      .select("logo-and-name");
    cy.get(".theme-inspector")
      .contains("label", "Logo height")
      .find("input")
      .should("have.value", "52")
      .clear()
      .type("72");
    cy.get("cl-typography-picker").should("be.visible");
    control("List view").click();
    row("pager_fixture").rightclick();
    cy.get('[aria-label="Block actions"]:popover-open')
      .contains("button", /^Copy/)
      .click();
    cy.get(".outline-document-settings").rightclick();
    cy.get('[aria-label="Block actions"]:popover-open')
      .contains("button", "Paste inside")
      .should("be.disabled");
    cy.get('[aria-label="Block actions"]:popover-open').trigger("keydown", {
      key: "Escape",
    });
    row("pager_fixture").should("exist");
    cy.contextCanvas(".theme-pagination").should("have.length", 1);
  });
  for (const kind of ["post", "page"])
    it(`uses the ${kind} title in a dedicated content block`, () => {
      cy.visit(`/admin/${kind}s/new`);
      cy.get('input[aria-label="Title"]').type("Current " + kind);
      control("Blocks").click();
      for (const type of [
        "core/site-brand",
        "core/title",
        "core/featured-image",
        "core/excerpt",
      ])
        cy.get(`[data-library-block="${type}"]`).should("exist");
      cy.get('[data-library-block="core/title"]').click();
      inspector();
      cy.get(".content-block-inspector")
        .contains("label", /^Text$/)
        .should("not.exist");
      cy.contextCanvas(".theme-content-title", ".content-live-preview").should(
        "contain",
        "Current " + kind,
      );
      cy.get('input[aria-label="Title"]')
        .clear()
        .type("Updated " + kind);
      cy.contextCanvas(".theme-content-title", ".content-live-preview").should(
        "contain",
        "Updated " + kind,
      );
      control("Save draft").click();
      cy.contains("All changes saved").should("exist");
      cy.request("/api/admin/state").then(({ body }) => {
        const entry = body.content.find(
          (entry) => entry.title === "Updated " + kind,
        );
        expect(
          entry.details.contentBlocks.some(
            (node) => node.type === "core/title",
          ),
        ).eq(true);
      });
    });
});
