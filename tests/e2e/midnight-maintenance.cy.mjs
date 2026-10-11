describe("Midnight interactive maintenance", () => {
  const id = "com.colossal.maintenance.midnight";
  before(() => {
    const headers = { Origin: "http://127.0.0.1:4201" };
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      headers,
      body: {},
      failOnStatusCode: false,
    });
    cy.request({
      method: "POST",
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.maintenance", action: "install" },
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1 },
    });
  });
  it("fills the public preview, animates geometry and keeps its identity and message visible on desktop and mobile", () => {
    cy.visit("/api/maintenance/" + id + "/preview");
    cy.get(".maintenance-geometry canvas")
      .should("be.visible")
      .should(($canvas) => {
        const canvas = $canvas[0];
        const pixels = canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted++;
        expect(painted).greaterThan(1000);
      });
    cy.get(".theme-site-brand").should("be.visible");
    cy.contains("h1", "Something brilliant is on its way.").should(
      "be.visible",
    );
    cy.get("body").should(($body) => {
      const body = $body[0],
        win = body.ownerDocument.defaultView;
      expect(
        win.getComputedStyle(body.querySelector(".maintenance-midnight-veil"))
          .backgroundColor,
      ).eq("rgba(3, 14, 48, 0.88)");
      const host = body
        .querySelector(".maintenance-geometry")
        .getBoundingClientRect();
      expect(host.width).eq(win.innerWidth);
      expect(host.height).eq(win.innerHeight);
      expect(
        win.getComputedStyle(body.querySelector(".maintenance-card"))
          .backgroundColor,
      ).eq("rgba(0, 0, 0, 0)");
    });
    cy.get(".maintenance-geometry canvas").then(($canvas) => {
      const image = $canvas[0].toDataURL();
      cy.get(".maintenance-geometry canvas").should(($next) =>
        expect($next[0].toDataURL()).not.eq(image),
      );
    });
    cy.get("body").trigger("pointermove", {
      clientX: 300,
      clientY: 260,
      pointerType: "mouse",
    });
    cy.screenshot("midnight-desktop", { capture: "viewport" });
    cy.viewport(390, 844);
    cy.contains("h1", "Something brilliant is on its way.").should(
      "be.visible",
    );
    cy.get("body").should(($body) => expect($body[0].scrollWidth).eq(390));
    cy.screenshot("midnight-mobile", { capture: "viewport" });
  });
  it("renders the animated scene in the script-free editor canvas", () => {
    cy.visit("/admin/maintenance/edit/" + id);
    cy.get("iframe.theme-live-preview").should(($frame) => {
      const doc = $frame[0].contentDocument;
      expect(doc.querySelector(".maintenance-geometry canvas")).not.eq(null);
      expect(doc.querySelector(".theme-site-brand")).not.eq(null);
      expect(doc.querySelector("h1").textContent).contain(
        "Something brilliant",
      );
    });
  });
  it("keeps the scene still for visitors who prefer reduced motion", () => {
    cy.visit("/api/maintenance/" + id + "/preview", {
      onBeforeLoad(win) {
        const match = win.matchMedia.bind(win);
        win.matchMedia = (query) => {
          const result = match(query);
          if (query === "(prefers-reduced-motion: reduce)")
            Object.defineProperty(result, "matches", { value: true });
          return result;
        };
      },
    });
    cy.get(".maintenance-geometry canvas").should("be.visible");
    cy.wait(200);
    cy.get(".maintenance-geometry canvas").then(($canvas) => {
      const snapshot = $canvas[0].toDataURL();
      cy.wait(200);
      cy.get(".maintenance-geometry canvas").then(($next) =>
        expect($next[0].toDataURL()).eq(snapshot),
      );
    });
  });
});
