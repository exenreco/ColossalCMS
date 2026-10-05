describe("Post and page HTML editing", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const openOutline = () => {
    cy.get('[aria-label="View mode"] [aria-label="Outline"]').click();
    cy.get(".content-theme-outline > cl-theme-block-tree .theme-node-label")
      .first()
      .should("contain.text", "Main");
    cy.get('.theme-editor-subbar [aria-label="Blocks"]').click();
  };
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
  });
  for (const kind of ["post", "page"]) {
    it(`opens the canvas block list and edits ${kind} blocks`, () => {
      cy.visit(`/admin/${kind}s`);
      cy.contains("button", `Create ${kind}`).first().click();
      cy.get('[aria-label="Title"]').type(`Block list ${kind}`);
      cy.get('.theme-editor-subbar [aria-label="Block list"]').click();
      cy.get("#block-list-drawer").should("be.visible");
      cy.get("#block-list-drawer .block-list-tree").should("contain", "Main");
      cy.get("#block-list-drawer [data-block-type='core/rich-text']")
        .first()
        .find(".theme-tree-row")
        .first()
        .rightclick();
      cy.get('[aria-label="Block actions"]')
        .contains("button", "Duplicate")
        .click();
      cy.get("#block-list-drawer [data-block-type='core/rich-text']").should(
        "have.length",
        2,
      );
      cy.get("#block-list-drawer [data-block-type='core/rich-text']")
        .first()
        .invoke("attr", "data-outline-id")
        .then((id) => {
          const transfer = new DataTransfer();
          cy.get("#block-list-drawer [data-block-type='core/rich-text']")
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
            .should("have.attr", "data-outline-id", id);
        });
      cy.get("#block-list-drawer [data-block-type='core/rich-text']")
        .last()
        .find(".theme-tree-row")
        .first()
        .rightclick();
      cy.get('[aria-label="Block actions"]').contains("button", "Cut").click();
      cy.get("#block-list-drawer [data-block-type='core/rich-text']").should(
        "have.length",
        1,
      );
      cy.get('.theme-editor-subbar [aria-label="Blocks"]').click();
      cy.get("#block-list-drawer").should("not.be.visible");
      cy.get("#block-library-drawer").should("be.visible");
    });
    it(`edits a ${kind} as HTML and keeps its excerpt in the right panel`, () => {
      cy.visit(`/admin/${kind}s`);
      cy.contains("button", `Create ${kind}`).first().click();
      cy.get('[aria-label="Title"]').type(`HTML ${kind} story`);
      cy.get("cl-contextual-block-toolbar").should("be.visible");
      cy.get(".editor-writing").should(
        "not.contain",
        "A short introduction for your readers",
      );
      cy.get(".editor-options").within(() => {
        cy.get('[aria-label="Excerpt"]').type(`Summary for ${kind}`);
      });
      if (kind === "post") {
        cy.get(".editor-writing").scrollTo("top");
        cy.get(".editor-options").scrollTo("top");
        cy.screenshot("post-editor-blocks", { capture: "viewport" });
      }
      cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
      cy.get('[aria-label="HTML source"]')
        .invoke(
          "val",
          "<h2>Source heading</h2><p>Hello <strong>from HTML</strong>.</p>",
        )
        .trigger("input");
      if (kind === "post") {
        cy.get(".editor-writing").scrollTo("top");
        cy.screenshot("post-editor-html", { capture: "viewport" });
      }
      cy.get(".editor-topbar").contains("button", "Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const item = body.content.find((c) => c.title === `HTML ${kind} story`);
        expect(item.excerpt).eq(`Summary for ${kind}`);
        expect(item.details.richText.content[0].type).eq("heading");
        expect(
          item.details.richText.content[1].content.some((n) =>
            n.marks?.some((m) => m.type === "bold"),
          ),
        ).eq(true);
      });
      cy.get('[aria-label="Editor mode"]').contains("button", "Blocks").click();
      cy.get('[aria-label="View mode"] [aria-label="Outline"]').click();
      cy.get('[data-block-type="core/rich-text"]').should("exist");
      cy.get(".content-block-inspector textarea").should(
        "contain.value",
        "<h2>Source heading</h2>",
      );
      cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
      cy.get('[aria-label="HTML source"]').should(
        "contain.value",
        "<strong>from HTML</strong>",
      );
      cy.get(".editor-topbar").contains("button", "Publish").click();
      cy.contains(`Your ${kind} is published.`).should("exist");
      if (kind === "page") {
        cy.visit("/html-page-story");
        cy.get(".theme-root h2").should("contain", "Source heading");
        cy.get(".theme-root strong").should("contain", "from HTML");
      }
    });
    it(`preserves safe HTML block markup in a ${kind}`, () => {
      const title = `HTML block markup ${kind}`;
      const fragment =
        '<section class="story-block"><div class="story-layout"><pre><code>const answer = 42;</code></pre><p>Block content</p></div></section>';
      cy.visit(`/admin/${kind}s`);
      cy.contains("button", `Create ${kind}`).first().click();
      cy.get('[aria-label="Title"]').type(title);
      cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
      cy.get('[aria-label="HTML source"]')
        .invoke("val", fragment)
        .trigger("input");
      cy.get('[aria-label="Editor mode"]').contains("button", "Blocks").click();
      cy.get(".content-live-preview")
        .its("0.contentDocument.body")
        .find(".story-block pre code")
        .should("contain.text", "const answer = 42;");
      cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
      cy.get('[aria-label="HTML source"]').should("have.value", fragment);
      cy.get(".editor-topbar").contains("button", "Save draft").click();
      cy.contains("All changes saved").should("be.visible");
      cy.request("/api/admin/state").then(({ body }) => {
        const item = body.content.find((entry) => entry.title === title);
        expect(item.details.contentBlocks[0].settings.html).eq(fragment);
        cy.visit(`/admin/${kind}s/edit/${item.id}`);
      });
      cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
      cy.get('[aria-label="HTML source"]').should("have.value", fragment);
    });
  }
  it("edits the selected HTML fragment block without changing other blocks", () => {
    const fragment =
      '<section class="feature-grid"><div><code>renderBlock()</code></div></section>';
    cy.visit("/admin/pages");
    cy.contains("button", "Create page").first().click();
    cy.get('[aria-label="Title"]').type("HTML fragment page");
    cy.get('.theme-editor-subbar [aria-label="Blocks"]').click();
    cy.get("#block-library-drawer.content-theme-library")
      .contains(".block-library__heading", "Theme")
      .click();
    cy.get('[data-library-block="core/html"]').first().click();
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get(".editor-html-help").should("contain.text", "HTML fragment");
    cy.get('[aria-label="HTML source"]')
      .invoke("val", fragment)
      .trigger("input");
    cy.get('[aria-label="Editor mode"]').contains("button", "Blocks").click();
    cy.get(".content-live-preview")
      .its("0.contentDocument.body")
      .find(".feature-grid code")
      .should("contain.text", "renderBlock()");
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get('[aria-label="HTML source"]').should("have.value", fragment);
    cy.get(".editor-topbar").contains("button", "Save draft").click();
    cy.contains("All changes saved").should("be.visible");
    cy.request("/api/admin/state").then(({ body }) => {
      const item = body.content.find(
        (entry) => entry.title === "HTML fragment page",
      );
      expect(item.details.contentBlocks).to.have.length(2);
      expect(item.details.contentBlocks[0].type).eq("core/rich-text");
      expect(item.details.contentBlocks[1].type).eq("core/html");
      expect(item.details.contentBlocks[1].settings.html).eq(fragment);
    });
  });
  it("shows an unsaved page in Canvas, switches to Outline, and slides the Blocks drawer", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/content/render",
      headers,
      body: { content: { kind: "page", title: "Render probe", details: {} } },
    })
      .its("body.html")
      .should("not.contain", "Render probe");
    cy.intercept("POST", "/api/admin/content/render", (request) => {
      if (request.body.content?.title === "Canvas preview page")
        request.alias = "renderDraft";
    });
    cy.visit("/admin/pages");
    cy.contains("button", "Create page").first().click();
    cy.get('[aria-label="Title"]').type("Canvas preview page");
    cy.wait("@renderDraft").its("response.statusCode").should("eq", 200);
    cy.get('.content-canvas-status [role="alert"]').should("not.exist");
    cy.get('[aria-label="View mode"] [aria-label="Canvas"]').should(
      "have.attr",
      "aria-checked",
      "true",
    );
    cy.get(".content-live-preview")
      .invoke("attr", "srcdoc")
      .should("not.contain", "Canvas preview page");
    cy.get(".content-live-preview")
      .its("0.contentDocument.body")
      .find("main.content-main")
      .should("not.contain.text", "Canvas preview page");
    cy.get(
      '[aria-label="Responsive preview"] [aria-label="Mobile preview"]',
    ).click();
    cy.get(".content-live-preview").should("have.css", "width", "390px");
    cy.get('.theme-editor-subbar [aria-label="Blocks"]').click();
    cy.get(".content-editor-panes").should("have.class", "library-open");
    cy.get("#block-library-drawer.content-theme-library").should("be.visible");
    cy.get('[data-library-block="core/heading"]').first().scrollIntoView();
    cy.get('[data-library-block="core/heading"]')
      .first()
      .then(($source) => {
        const source = $source[0];
        const doc = source.ownerDocument;
        const frame = doc.querySelector(".content-live-preview");
        const from = source.getBoundingClientRect();
        const to = frame.getBoundingClientRect();
        const point = (rect) => ({
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + Math.min(rect.height / 2, 120),
        });
        source.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            button: 0,
            pointerId: 9,
            ...point(from),
          }),
        );
        doc.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            button: 0,
            pointerId: 9,
            ...point(to),
          }),
        );
        doc.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            button: 0,
            pointerId: 9,
            ...point(to),
          }),
        );
      });
    cy.get('[aria-label="View mode"] [aria-label="Outline"]').click();
    cy.get('[data-block-type="core/rich-text"]').should("exist");
    cy.get('[data-block-type="core/heading"]').should("exist");
    cy.get('.theme-editor-subbar [aria-label="Blocks"]').click();
    cy.get(".content-editor-panes").should("not.have.class", "library-open");
    cy.get('.editor-options [aria-label="Excerpt"]').should("exist");
  });
  it("shows selected block tools in the post Canvas and Outline", () => {
    cy.visit("/admin/posts");
    cy.contains("button", "Create post").first().click();
    cy.get('[aria-label="Title"]').type("Block toolbar story");
    cy.get(".content-live-preview")
      .invoke("attr", "srcdoc")
      .should("contain", "content-main");
    cy.get("cl-contextual-block-toolbar").should("be.visible");
    cy.get("cl-contextual-block-toolbar").then(($toolbar) => {
      const rect = $toolbar[0].getBoundingClientRect();
      const workspace = $toolbar[0]
        .closest(".content-editor-fullscreen")
        .querySelector(".editor-writing")
        .getBoundingClientRect();
      const canvas = $toolbar[0]
        .closest(".content-editor-fullscreen")
        .querySelector(".content-canvas-scroll")
        .getBoundingClientRect();
      expect(rect.top).to.be.gte(140);
      expect(rect.top).to.be.lt(720);
      expect(rect.right).to.be.lte(workspace.right);
      expect(rect.top).to.be.gte(canvas.top - 1);
    });
    cy.get("cl-contextual-block-toolbar [aria-label='Bold']").click();
    cy.get("cl-contextual-block-toolbar [aria-label='Bold']").should(
      "have.attr",
      "aria-pressed",
      "true",
    );
    cy.get(
      "cl-contextual-block-toolbar [aria-label='Duplicate block']",
    ).click();
    cy.get('[aria-label="View mode"] [aria-label="Outline"]').click();
    cy.get('[data-block-type="core/rich-text"]').should("have.length", 2);
    cy.get("cl-contextual-block-toolbar").should("be.visible");
    cy.get("cl-contextual-block-toolbar [aria-label='Delete block']").click();
    cy.get('[data-block-type="core/rich-text"]').should("have.length", 1);
  });
  it("shows only current page content and styles the Main wrapper", () => {
    cy.visit("/admin/pages");
    cy.contains("button", "Create page").first().click();
    cy.get('[aria-label="Title"]').type("Header click preview");
    cy.get(".content-live-preview")
      .invoke("attr", "srcdoc")
      .should("not.contain", "Header click preview");
    cy.get(".content-live-preview").should(($frame) => {
      const preview = $frame[0].contentDocument;
      expect(preview.querySelector("main.content-main")).not.eq(null);
      expect(
        preview.querySelector(
          ".theme-part-header,.theme-part-footer,.theme-part-content",
        ),
      ).eq(null);
      expect(preview.querySelector(".theme-site-brand,.theme-menu")).eq(null);
    });
    cy.get(".content-live-preview")
      .its("0.contentDocument.body")
      .find("main.content-main")
      .trigger("click");
    cy.get(".content-block-inspector").should("contain.text", "MAIN SETTINGS");
    cy.get(
      ".content-block-inspector cl-spacing-picker[kind='padding'] summary",
    ).click();
    cy.get(
      ".content-block-inspector cl-spacing-picker[kind='padding'] .cl-spacing-top input[type='number']",
    )
      .clear()
      .type("24");
    cy.get(".content-live-preview").should(($frame) => {
      expect(
        $frame[0].contentDocument.querySelector("main.content-main").style
          .paddingTop,
      ).eq("24px");
    });
    cy.get(".content-live-preview")
      .its("0.contentDocument.URL")
      .should("eq", "about:srcdoc");
    cy.get(".content-live-preview")
      .its("0.contentDocument.body")
      .should("not.contain.text", "Header click preview");
    cy.get(".editor-topbar").contains("button", "Save draft").click();
    cy.request("/api/admin/state").then(({ body }) => {
      const item = body.content.find(
        (entry) => entry.title === "Header click preview",
      );
      expect(item.details.contentMain.padding.top).eq(24);
    });
  });
  it("uses the Theme Editor library, layout blocks and Inspector", () => {
    cy.visit("/admin/posts");
    cy.contains("button", "Create post").first().click();
    cy.get('[aria-label="Title"]').type("Structured blocks");
    openOutline();
    cy.get(".content-block-inspector textarea")
      .clear()
      .type("<p>Opening paragraph</p>");
    cy.get('[data-library-block="core/heading"]').first().click();
    cy.get(".content-block-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("A section");
    cy.get(".content-block-inspector")
      .contains("label", "Heading level")
      .find("select")
      .select("h3");
    cy.get('[data-library-block="core/columns"]').first().click();
    cy.get('[data-block-type="core/column"]').should("have.length", 2);
    cy.get('[data-library-block="core/heading"]').first().click();
    cy.get(".content-block-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("Inside columns");
    cy.get('[data-block-type="core/column"]').should("have.length", 3);
    cy.get(".content-block-inspector").contains("button", "Duplicate").click();
    cy.get('[data-block-type="core/heading"]').should("have.length", 3);
    cy.get(".content-block-inspector").contains("button", "Delete").click();
    cy.get('[data-block-type="core/heading"]').should("have.length", 2);
    cy.get(".editor-topbar").contains("button", "Save draft").click();
    cy.contains("All changes saved").should("be.visible");
    cy.request("/api/admin/state").then(({ body }) => {
      const item = body.content.find((c) => c.title === "Structured blocks");
      expect(item.details.contentBlocks.map((n) => n.type)).deep.eq([
        "core/rich-text",
        "core/heading",
        "core/columns",
      ]);
      expect(item.details.contentBlocks[1].settings.level).eq("h3");
      expect(item.details.contentBlocks[2].children).to.have.length(3);
    });
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get('[aria-label="HTML source"]').should(
      "contain.value",
      "<p>Opening paragraph</p>",
    );
    cy.get('[aria-label="Editor mode"]').contains("button", "Blocks").click();
    cy.get(".editor-topbar").contains("button", "Publish").click();
    cy.request("/api/public").then(({ body }) => {
      const item = body.content.find((c) => c.title === "Structured blocks");
      const date = new Date(item.publishAt);
      cy.visit(
        `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${item.slug}`,
      );
    });
    cy.get(".theme-root h3").should("contain", "A section");
    cy.get(".theme-root").should("contain", "Inside columns");
    cy.get(".theme-root [data-block-id]").should("have.length.greaterThan", 3);
  });
  it("drags a library block onto an occupied content outline", () => {
    cy.visit("/admin/posts");
    cy.contains("button", "Create post").first().click();
    cy.get('[aria-label="Title"]').type("Dragged content block");
    openOutline();
    cy.get('[data-library-block="core/heading"]').first().scrollIntoView();
    cy.get(
      '[data-block-type="core/rich-text"] > .theme-tree-row',
    ).scrollIntoView();
    cy.get('[data-library-block="core/heading"]')
      .first()
      .then(($source) => {
        const source = $source[0];
        const doc = source.ownerDocument;
        const target = doc.querySelector(
          '[data-block-type="core/rich-text"] > .theme-tree-row',
        );
        const origin = source.getBoundingClientRect();
        const destination = target.getBoundingClientRect();
        const point = (rect) => ({
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        });
        source.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            button: 0,
            pointerId: 7,
            ...point(origin),
          }),
        );
        doc.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            button: 0,
            pointerId: 7,
            ...point(destination),
          }),
        );
        doc.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            button: 0,
            pointerId: 7,
            ...point(destination),
          }),
        );
      });
    cy.get('[data-block-type="core/heading"]').should("have.length", 1);
    cy.get('[data-block-type="core/heading"] > .theme-tree-row').then(
      ($row) => {
        const row = $row[0];
        const doc = row.ownerDocument;
        const zone = doc.querySelector(
          '.content-theme-outline .theme-drop-zone[data-drop-index="2"]',
        );
        const transfer = new DataTransfer();
        row.dispatchEvent(
          new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }),
        );
        zone.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
        zone.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
      },
    );
    cy.get(".editor-topbar").contains("button", "Save draft").click();
    cy.request("/api/admin/state").then(({ body }) => {
      const item = body.content.find(
        (entry) => entry.title === "Dragged content block",
      );
      expect(item.details.contentBlocks.map((node) => node.type)).deep.eq([
        "core/rich-text",
        "core/heading",
      ]);
    });
  });
  it("rejects unsafe HTML source before saving", () => {
    cy.visit("/admin/pages");
    cy.contains("button", "Create page").first().click();
    cy.get('[aria-label="Title"]').type("Unsafe source check");
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get('[aria-label="HTML source"]')
      .invoke("val", '<p>Safe text</p><script>alert("bad")</script>')
      .trigger("input");
    cy.get(".editor-topbar").contains("button", "Save draft").click();
    cy.contains("Remove scripts, embeds, and forms").should("be.visible");
    cy.request("/api/admin/state").then(({ body }) => {
      expect(body.content.some((c) => c.title === "Unsafe source check")).eq(
        false,
      );
    });
  });
  it("warns before leaving unsaved HTML edits", () => {
    cy.visit("/admin/posts");
    cy.contains("button", "Create post").first().click();
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get('[aria-label="HTML source"]')
      .invoke("val", "<p>Unsaved source</p>")
      .trigger("input");
    cy.get('[aria-label="Close editor"]').click();
    cy.contains("Leave unsaved changes?").should("be.visible");
    cy.contains("button", "Keep editing").click();
    cy.get('[aria-label="HTML source"]').should(
      "contain.value",
      "Unsaved source",
    );
  });
  it("keeps the editor controls usable on a phone-width screen", () => {
    cy.viewport(390, 844);
    cy.visit("/admin/pages");
    cy.contains("button", "Create page").first().click();
    cy.get('[aria-label="Editor mode"]').contains("button", "HTML").click();
    cy.get('[aria-label="HTML source"]').should("be.visible");
    cy.get(".editor-options").find('[aria-label="Excerpt"]').should("exist");
    cy.window().then((win) =>
      expect(win.document.documentElement.scrollWidth).to.be.at.most(
        win.innerWidth,
      ),
    );
    cy.screenshot("page-editor-mobile-html", { capture: "viewport" });
  });
});
