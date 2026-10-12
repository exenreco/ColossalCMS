describe("Media library types and appearance", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
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
  });
  it("uploads PDFs, filters by type, and opens themed details with the information icon", () => {
    cy.visit("/admin/media");
    cy.get('select[aria-label="Media type"]')
      .find("option")
      .should("have.length", 6);
    cy.contains("button", "Upload media").first().click();
    cy.get(".upload-dropzone").should(
      "have.css",
      "background-color",
      "rgb(14, 14, 14)",
    );
    cy.get('input[type="file"]')
      .should("have.attr", "accept")
      .and("include", ".pdf");
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      ),
      fileName: "library-resume.pdf",
      mimeType: "application/pdf",
    });
    cy.get(".upload-dialog").contains("button", "Upload file").click();
    cy.get(".upload-dialog").should("not.exist");
    cy.get('select[aria-label="Media type"]').select("pdf");
    cy.contains(".media-card", "library-resume.pdf").as("pdf");
    cy.get("@pdf").find(".media-type-overlay").should("have.text", "PDF");
    cy.get("@pdf")
      .find('.media-card-info cl-icon[name="details"] svg path')
      .should("have.attr", "d")
      .and("include", "M12 11v6");
    cy.get("@pdf")
      .find('[aria-label="Details for library-resume.pdf"]')
      .click();
    cy.get(".media-drawer").should(
      "have.css",
      "background-color",
      "rgb(10, 10, 10)",
    );
    cy.get('.media-drawer input[name="name"]').should(
      "have.css",
      "background-color",
      "rgb(14, 14, 14)",
    );
    cy.get(".media-detail-preview").should(
      "have.css",
      "background-color",
      "rgb(14, 14, 14)",
    );
    cy.get(".media-document-preview a")
      .should("contain.text", "Open PDF")
      .and("have.attr", "target", "_blank");
    cy.get('.media-drawer input[name="name"]').clear().type("Portfolio resume");
    cy.contains("button", "Save details").click();
    cy.get('[aria-label="Close media details"]').click();
    cy.get('select[aria-label="Media type"]').select("image");
    cy.contains(".media-card", "Portfolio resume").should("not.exist");
    cy.get('select[aria-label="Media type"]').select("all");
    cy.contains(".media-card", "Portfolio resume").should("be.visible");
    cy.screenshot("media-library-dark");
  });
  it("keeps the drawer and upload area readable in light mode", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/settings",
      headers,
      body: { adminColorMode: "light" },
    });
    cy.visit("/admin/media");
    cy.get("html").should("have.attr", "data-admin-mode", "light");
    cy.get('[aria-label="Details for Portfolio resume"]').click();
    cy.get(".media-drawer").should(
      "have.css",
      "background-color",
      "rgb(255, 255, 255)",
    );
    cy.get('[aria-label="Close media details"]').click();
    cy.contains("button", "Upload media").first().click();
    cy.get(".upload-dropzone").should(
      "not.have.css",
      "background-color",
      "rgb(14, 14, 14)",
    );
    cy.screenshot("media-upload-light");
  });
});
