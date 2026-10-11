describe("Slider and overlay blocks", () => {
  const origin = { Origin: "http://127.0.0.1:4201" };
  let themeId;
  const control = (name) =>
    cy.get(`.shared-editor button[aria-label="${name}"]`).filter(":visible");
  const inspector = () => {
    cy.get('[aria-label="Toggle Inspector"]').then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
  };
  const outline = () => {
    cy.get(".blocks-trigger").then((button) => {
      if (button.attr("aria-pressed") === "true") control("Outline").click();
      else
        cy.get('[aria-label="Outline"]').then((button) => {
          if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
        });
    });
  };
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers: origin,
      failOnStatusCode: false,
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers: origin,
      body: { walkthroughVersion: 1 },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          body: { revision: body.revision, name: "Slider block test" },
          headers: origin,
        }),
      )
      .then(({ body }) => (themeId = body.id));
  });

  const find = (type) =>
    cy.get(`.theme-outline .theme-tree-node[data-block-type="${type}"]`);
  const search = (value) => {
    cy.get(".blocks-trigger").then((button) => {
      if (button.attr("aria-pressed") !== "true") cy.wrap(button).click();
    });
    cy.get(".block-library__search").clear().type(value);
  };
  const dragLibraryInto = (type, parentId, pointerId) => {
    cy.get(".theme-live-preview")
      .its("0.contentDocument.body")
      .find(`[data-block-id="${parentId}"]`)
      .scrollIntoView();
    cy.get(`[data-library-block="${type}"]`).then((source) => {
      const doc = source[0].ownerDocument;
      const frame = doc.querySelector(".theme-live-preview");
      const block = frame.contentDocument.querySelector(
        `[data-block-id="${parentId}"]`,
      );
      block.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = frame.getBoundingClientRect();
      const target = block.getBoundingClientRect();
      const start = source[0].getBoundingClientRect();
      const point = {
        clientX: rect.left + target.left + target.width / 2,
        clientY: rect.top + target.top + Math.min(target.height / 2, 100),
      };
      expect(doc.elementFromPoint(point.clientX, point.clientY)).eq(frame);
      const hitId = frame.contentDocument
        .elementFromPoint(point.clientX - rect.left, point.clientY - rect.top)
        ?.closest("[data-block-id]")?.dataset.blockId;
      expect(hitId, "visible parent under the drop point").eq(parentId);
      source[0].dispatchEvent(
        new doc.defaultView.PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          button: 0,
          buttons: 1,
          clientX: start.left + 8,
          clientY: start.top + 8,
        }),
      );
      for (const name of ["pointermove", "pointerup"]) {
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
        if (name === "pointermove")
          expect(
            frame.contentDocument.querySelector(".cl-drop-indicator")?.hidden,
          ).eq(false);
      }
    });
    cy.get(".theme-editor-viewport").should("not.have.class", "is-dragging");
    outline();
  };

  it("edits a Slide image background through the shared popover", () => {
    cy.visit("/admin/themes/edit/" + themeId);

    search("Slider");
    cy.get('[data-library-block="core/slider"]').click();
    outline();
    find("core/slide")
      .first()
      .find(".theme-tree-row .theme-node-label")
      .first()
      .click();
    inspector();
    cy.get(
      ".theme-inspector cl-slide-background-picker .cl-picker-trigger",
    ).click();
    const picker = () =>
      cy.get('[aria-label="Slide background picker"].cl-picker-popover');
    picker().contains("label", "Type").find("select").select("image");
    picker().find('input[type="url"]').type("https://example.com/slide.jpg");
    picker().contains("label", "Size").find("select").select("contain");
    picker()
      .contains("label", "Horizontal position")
      .find("select")
      .select("right");
    picker()
      .contains("label", "Vertical position")
      .find("select")
      .select("bottom");
    picker().contains("label", "Repeat").find("select").select("repeat-x");
    picker().contains("button", "Choose media").click();
    cy.get(".media-picker-dialog").should("be.visible");
    cy.get(".media-picker-dialog").contains("button", "Cancel").click();
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".theme-live-preview").should((frame) => {
      const doc = frame[0].contentDocument;
      const slide = doc.querySelector(".cl-swiper .swiper-slide");
      const background = slide?.querySelector(".cl-slide-background");
      expect(background).not.eq(null);
      const style = doc.defaultView.getComputedStyle(background);
      expect(style.backgroundImage).to.include("https://example.com/slide.jpg");
      expect(style.backgroundPosition).eq("100% 100%");
      expect(style.backgroundRepeat).eq("repeat-x");
    });
  });

  it("adds Slides, drags Overlays into Slides and 3D models, and renders Swiper", () => {
    cy.viewport(1280, 900);
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
      },
    });

    search("Slider");
    cy.get('[data-library-block="core/slider"]').click();
    outline();
    find("core/slider").should("have.length", 1);
    find("core/slide").should("have.length", 2);
    cy.get(".theme-inspector")
      .contains("label", "Slides per view")
      .should("exist");
    cy.get(".theme-inspector cl-animation-picker").should("not.exist");
    inspector();
    cy.get(".theme-inspector cl-dimensions-picker .cl-picker-trigger").click();
    cy.get(".theme-inspector cl-dimensions-picker")
      .contains("label", "Min height")
      .find("input[type='checkbox']")
      .check();
    cy.get(".theme-inspector cl-dimensions-picker cl-unit-input")
      .eq(1)
      .find("input[type='number']")
      .clear()
      .type("600");
    outline();
    find("core/slide")
      .first()
      .then((slide) => {
        const id = slide.attr("data-outline-id");
        search("Overlay");
        dragLibraryInto("core/overlay", id, 30);
        find("core/slide")
          .first()
          .find('.theme-tree-node[data-block-type="core/overlay"]')
          .should("have.length", 1);
      });
    find("core/slide")
      .first()
      .find(
        '.theme-tree-node[data-block-type="core/overlay"] > .theme-tree-row .theme-node-label',
      )
      .click();
    search("Heading");
    cy.get('[data-library-block="core/heading"]').last().click();
    outline();
    find("core/slide")
      .first()
      .find('.theme-tree-node[data-block-type="core/overlay"]')
      .find('.theme-tree-node[data-block-type="core/heading"]')
      .should("have.length", 1);
    cy.get(".outline-document-settings").click();
    search("3D model");
    cy.get('[data-library-block="core/gltf"]').click();
    inspector();
    cy.get(".theme-inspector")
      .contains("label", "Model description")
      .find("input")
      .type("A model with a caption");
    outline();
    find("core/gltf").then((model) => {
      const id = model.attr("data-outline-id");
      search("Overlay");
      dragLibraryInto("core/overlay", id, 31);
      find("core/gltf")
        .find('.theme-tree-node[data-block-type="core/overlay"]')
        .should("have.length", 1);
    });
    cy.get(".theme-live-preview").should("be.visible");
    cy.get(".theme-live-preview").should((frame) => {
      const doc = frame[0].contentDocument;
      const swiper = doc.querySelector(".cl-swiper[data-swiper-ready='true']");
      expect(swiper).not.eq(null);
      expect(swiper.getBoundingClientRect().height).to.be.at.least(600);
      expect(doc.querySelectorAll(".cl-swiper .swiper-slide").length).eq(2);
      expect(doc.querySelectorAll(".cl-overlay-block").length).eq(2);
    });
    cy.get(".theme-live-preview").then((frame) => {
      const doc = frame[0].contentDocument;
      const host = doc.querySelector(".cl-swiper");
      const slider = host.swiper;
      expect(slider?.initialized).eq(true);
      expect(host.querySelectorAll(".swiper-navigation-icon")).to.have.length(
        0,
      );
      const before = slider.activeIndex;
      doc.querySelector(".swiper-button-next").click();
      expect(slider.activeIndex).not.eq(before);
    });
    cy.get(".theme-live-preview").should((frame) => {
      const slides = frame[0].contentDocument.querySelectorAll(
        ".cl-swiper .swiper-slide",
      );
      expect(slides[1].classList.contains("swiper-slide-active")).eq(true);
    });
    control("Save draft").click();
    cy.contains("Draft saved").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body }) => {
      const tree = body.draft.templates.home;
      const slider = tree.children.find((node) => node.type === "core/slider");
      const model = tree.children.find((node) => node.type === "core/gltf");
      expect(slider.children).to.have.length(2);
      expect(slider.settings.minHeightEnabled).eq(true);
      expect(slider.settings.minHeight).eq(600);
      expect(slider.children[0].children[0].type).eq("core/overlay");
      expect(slider.children[0].children[0].children[0].type).eq(
        "core/heading",
      );
      expect(model.children[0].type).eq("core/overlay");
    });
    cy.request({
      method: "POST",
      url: "/api/themes/" + themeId + "/preview",
      body: { templateId: "home" },
      headers: origin,
    }).then(({ body }) => {
      const token = new URL(body.url, "http://127.0.0.1:4201").searchParams.get(
        "themePreview",
      );
      cy.request("/api/public").then(({ body: site }) => {
        const page = site.content.find(
          (entry) => entry.kind === "page" && entry.status === "published",
        );
        expect(page).not.eq(undefined);
        cy.visit(`/${page.slug}?themePreview=${encodeURIComponent(token)}`);
      });
    });
    cy.get(".cl-swiper[data-swiper-ready='true']").should("exist");
    cy.get(".cl-swiper").should(($swiper) => {
      expect($swiper[0].getBoundingClientRect().height).to.be.at.least(600);
    });
    cy.get(".cl-swiper").then((host) => {
      const slider = host[0].swiper;
      expect(slider?.initialized).eq(true);
      expect(
        host[0].querySelectorAll(".swiper-navigation-icon"),
      ).to.have.length(0);
      const before = slider.activeIndex;
      host[0].querySelector(".swiper-button-next").click();
      expect(slider.activeIndex).not.eq(before);
    });
  });
});
