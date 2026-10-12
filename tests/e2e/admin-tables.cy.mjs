describe("Admin tables, bulk actions and details drawer", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  const entries = [];
  before(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "dark" },
    });
    for (let i = 1; i <= 12; i++) {
      const number = String(i).padStart(2, "0");
      cy.request({
        method: "POST",
        url: "/api/admin/content",
        headers,
        body: {
          kind: "page",
          title: `Bulk table ${number}`,
          slug: `bulk-table-${number}`,
          body: "Keep this content intact.",
          status: "draft",
          details: {},
        },
      }).then(({ body }) => entries.push(body.id));
    }
  });
  it("paginates and selects visible rows, preserves partial failures, and uses the blurred Quick Edit drawer", () => {
    cy.visit("/admin/pages");
    cy.get('input[aria-label="Search content"]').type("Bulk table");
    cy.contains("button.table-sort", "Title").click();
    cy.get("tbody tr").should("have.length", 10);
    cy.get(".table-scroll").then(($table) => {
      const top =
        $table[0].getBoundingClientRect().top +
        $table[0].ownerDocument.defaultView.scrollY;
      cy.get('input[aria-label="Select all visible entries"]').check();
      cy.get(".table-scroll").should(($updated) => {
        expect(
          $updated[0].getBoundingClientRect().top +
            $updated[0].ownerDocument.defaultView.scrollY,
        ).to.equal(top);
      });
    });
    cy.get("tbody input[type=checkbox]:checked").should("have.length", 10);
    cy.get("cl-bulk-actions strong").should("not.exist");
    cy.get(".bulk-clear-selection").should("be.visible");
    cy.get('button[aria-label="Next page"]').click();
    cy.get("tbody tr").should("have.length", 2);
    cy.get('input[aria-label="Select all visible entries"]').check();
    cy.get("tbody input[type=checkbox]:checked").should("have.length", 2);
    cy.contains("button", "Clear selection").click();
    cy.get('button[aria-label="Previous page"]').click();
    cy.get('input[aria-label="Select Bulk table 01"]').check();
    cy.get('input[aria-label="Select Bulk table 02"]').check();
    let failSecond = true;
    cy.intercept("POST", "/api/admin/content", (request) => {
      if (failSecond && request.body.id === entries[1])
        request.reply({
          statusCode: 409,
          body: { error: "Changed in another editor." },
        });
      else request.continue();
    });
    cy.get('select[aria-label="Bulk action"]').select("published");
    cy.get("cl-bulk-actions").contains("button", "Apply").click();
    cy.contains("1 of 2 entries updated.").should("be.visible");
    cy.contains("Failed entries remain selected.").should("be.visible");
    cy.get('input[aria-label="Select Bulk table 01"]').should("not.be.checked");
    cy.get('input[aria-label="Select Bulk table 02"]').should("be.checked");
    cy.contains("tr", "Bulk table 01").should("contain.text", "published");
    cy.then(() => {
      failSecond = false;
    });
    cy.get("cl-bulk-actions").contains("button", "Apply").click();
    cy.contains("1 of 1 entries updated.").should("be.visible");
    cy.contains("tr", "Bulk table 02")
      .find(".title-button")
      .should("not.be.disabled")
      .focus();
    cy.contains("tr", "Bulk table 02").contains("button", "Quick Edit").click();
    cy.get("cl-admin-modal [role=dialog]").should("be.visible");
    cy.get(".admin-modal-overlay").should(
      "have.css",
      "backdrop-filter",
      "blur(6px)",
    );
    cy.get('form.quick-edit-dialog input[name="title"]').should("be.focused");
    cy.get('form.quick-edit-dialog select[name="status"]').should(
      "have.value",
      "published",
    );
    cy.screenshot("admin-quick-edit-drawer", { capture: "viewport" });
    cy.get('form.quick-edit-dialog input[name="title"]').type("{esc}");
    cy.get("cl-admin-modal").should("not.exist");
    cy.focused().should("contain.text", "Quick Edit");
    cy.scrollTo("top");
    cy.screenshot("admin-content-table", { capture: "viewport" });
    cy.get('select[aria-label="Rows per page"]').select("25");
    cy.get('input[aria-label="Select all visible entries"]').check();
    cy.get('select[aria-label="Bulk action"]').select("delete");
    cy.get("cl-bulk-actions").contains("button", "Apply").click();
    cy.get("cl-admin-modal").contains("button", "Cancel").click();
    cy.get("tbody tr").should("have.length", 12);
    cy.get("cl-bulk-actions").contains("button", "Apply").click();
    cy.get("cl-admin-modal").contains("button", "Delete selected").click();
    cy.contains("12 of 12 entries updated.").should("be.visible");
    cy.contains("No pages found").should("be.visible");
  });
  it("bulk-updates posts without changing their content and renders the drawer in light mode on mobile", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/content",
      headers,
      body: {
        kind: "post",
        title: "Bulk post example",
        slug: "bulk-post-example",
        body: "Original content stays intact.",
        status: "published",
        details: {},
      },
    }).then(({ body }) => {
      cy.visit("/admin/posts");
      cy.get('input[aria-label="Search content"]').type("Bulk post example");
      cy.get('input[aria-label="Select all visible entries"]').check();
      cy.get('select[aria-label="Bulk action"]').select("draft");
      cy.get("cl-bulk-actions").contains("button", "Apply").click();
      cy.contains("1 of 1 entries updated.").should("be.visible");
      cy.request("/api/admin/state").then(({ body: state }) => {
        const post = state.content.find((c) => c.id === body.id);
        expect(post.status).to.equal("draft");
        expect(post.body).to.equal("Original content stays intact.");
      });
      cy.request({
        method: "POST",
        url: "/api/admin/settings",
        headers,
        body: { adminColorMode: "light" },
      });
      cy.viewport(390, 844);
      cy.reload();
      cy.contains("tr", "Bulk post example").find(".title-button").focus();
      cy.contains("tr", "Bulk post example")
        .contains("button", "Quick Edit")
        .click();
      cy.get(".admin-modal").should(
        "have.css",
        "background-color",
        "rgb(255, 255, 255)",
      );
      cy.get(".admin-modal").should("have.css", "width", "390px");
      cy.screenshot("admin-mobile-quick-edit", { capture: "viewport" });
      cy.get('button[aria-label="Close Quick Edit post"]').click();
      cy.get("cl-admin-modal").should("not.exist");
    });
  });
  it("bulk-manages extensions while core plugin checkboxes stay disabled", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "dark" },
    });
    cy.visit("/admin/plugins");
    cy.get('button[aria-label="List view"]').click();
    cy.get('button[aria-label="Show core plugins"]').then(($button) => {
      if ($button.attr("aria-checked") !== "true") cy.wrap($button).click();
    });
    cy.get('select[aria-label="Rows per page"]').select("100");
    cy.get('input[aria-label="Select Pages"]').should("be.disabled");
    cy.request("/api/admin/state").then(({ body }) => {
      const extensions = body.plugins
        .filter((p) => !p.isCore && !p.uploaded && p.installed)
        .slice(0, 2);
      expect(extensions).to.have.length(2);
      for (const p of extensions)
        cy.get(`input[aria-label="Select ${p.name}"]`).check();
      cy.get('select[aria-label="Bulk action"]').select("deactivate");
      cy.get("cl-bulk-actions").contains("button", "Apply").click();
      cy.contains("2 of 2 plugins updated.").should("be.visible");
      for (const p of extensions) {
        cy.contains("tr", p.name).should("contain.text", "Inactive");
        cy.get(`input[aria-label="Select ${p.name}"]`).check();
      }
      cy.get('select[aria-label="Bulk action"]').select("activate");
      cy.get("cl-bulk-actions").contains("button", "Apply").click();
      cy.get("cl-bulk-actions").should("contain.text", "0 selected");
      cy.request("/api/admin/state").then(({ body: state }) => {
        extensions.forEach((p) =>
          expect(
            state.plugins.find((item) => item.id === p.id).active,
          ).to.equal(true),
        );
      });
      cy.get(".plugin-table tbody tr")
        .first()
        .should(($row) => {
          const canvas = $row[0].ownerDocument.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d");
          context.fillStyle = $row.css("background-color");
          context.fillRect(0, 0, 1, 1);
          const rgb = context.getImageData(0, 0, 1, 1).data;
          expect(Math.max(...rgb.slice(0, 3))).to.be.lessThan(40);
        });
      cy.scrollTo("top");
      cy.screenshot("admin-plugin-table", { capture: "viewport" });
    });
  });
});
