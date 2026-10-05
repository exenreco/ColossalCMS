describe("Shared appearance pickers", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers,
      failOnStatusCode: false,
    });
  });

  it("replaces theme appearance inputs and saves picker changes", () => {
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "Picker test" },
        }),
      )
      .then(({ body }) => {
        cy.visit("/admin/themes/edit/" + body.id, {
          onBeforeLoad(win) {
            win.sessionStorage.setItem("colossal.inspector.open", "true");
          },
        });
        cy.get(".theme-inspector cl-appearance-picker-panel").should("exist");
        cy.get(".theme-inspector .inspector-title").should("contain", "Body");
        cy.get("iframe.theme-live-preview").should(($frame) => {
          const preview = $frame[0].contentDocument;
          expect(preview.body.classList.contains("theme-root")).eq(true);
          const rootId = preview.body.getAttribute("data-block-id");
          expect(rootId).to.match(/^blk_/);
          expect(preview.body.querySelector(`[data-block-id="${rootId}"]`)).eq(
            null,
          );
          expect(
            preview.body.querySelector(".theme-part-header .theme-block"),
          ).not.eq(null);
        });
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-trigger")
          .click();
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-popover")
          .should("match", ":popover-open");
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find("input[type='color']")
          .should("not.exist");
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-color-wheel")
          .then(($wheel) => {
            const rect = $wheel[0].getBoundingClientRect();
            cy.wrap($wheel)
              .trigger("pointerdown", {
                pointerId: 7,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + 5,
              })
              .trigger("pointermove", {
                pointerId: 7,
                clientX: rect.right - 5,
                clientY: rect.top + rect.height / 2,
              })
              .trigger("pointerup", {
                pointerId: 7,
                clientX: rect.right - 5,
                clientY: rect.top + rect.height / 2,
              });
          });
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-trigger .cl-picker-badge")
          .should("not.have.css", "background-color", "rgb(17, 24, 39)");
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-alpha-range")
          .then(($range) => {
            const style = $range[0].ownerDocument.defaultView.getComputedStyle(
              $range[0],
            );
            expect(style.backgroundImage).to.include("conic-gradient");
          });
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-reset")
          .click();
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-trigger .cl-picker-badge")
          .should("contain", "T");
        cy.get(".theme-inspector cl-color-picker")
          .eq(1)
          .find(".cl-picker-trigger")
          .click();
        cy.get(".theme-inspector cl-color-picker")
          .eq(1)
          .find(".cl-picker-swatches button")
          .first()
          .click();
        cy.get(".theme-inspector cl-color-picker")
          .eq(1)
          .find(".cl-picker-reset")
          .click();
        cy.get(".theme-inspector cl-color-picker")
          .eq(1)
          .find(".cl-picker-trigger .cl-picker-badge")
          .should("contain", "B");
        cy.get(".theme-inspector cl-color-picker")
          .eq(1)
          .find(".cl-picker-range-label")
          .then(($labels) => {
            const widths = [...$labels].map(
              (label) => label.getBoundingClientRect().width,
            );
            expect(new Set(widths).size).eq(1);
          });
        cy.get(
          ".theme-inspector cl-gradient-picker .cl-picker-trigger",
        ).click();
        cy.get(".theme-inspector cl-color-picker")
          .first()
          .find(".cl-picker-popover")
          .should("not.match", ":popover-open");
        cy.get(".theme-inspector cl-gradient-picker .cl-picker-popover").should(
          "match",
          ":popover-open",
        );
        cy.get(".theme-inspector cl-gradient-picker")
          .contains("Stop position")
          .should("not.exist");
        cy.get(".theme-inspector cl-gradient-picker .cl-gradient-rail").then(
          ($rail) => {
            const rect = $rail[0].getBoundingClientRect();
            cy.wrap($rail)
              .trigger("pointerdown", {
                button: 0,
                pointerId: 9,
                clientX: rect.left + rect.width * 0.25,
                clientY: rect.top + rect.height / 2,
              })
              .trigger("pointerup", {
                button: 0,
                pointerId: 9,
                clientX: rect.left + rect.width * 0.25,
                clientY: rect.top + rect.height / 2,
              });
          },
        );
        cy.get(".theme-inspector cl-gradient-picker .cl-gradient-stop").should(
          "have.length",
          3,
        );
        cy.get(".theme-inspector cl-gradient-picker .cl-gradient-rail").then(
          ($rail) => {
            const rect = $rail[0].getBoundingClientRect();
            cy.get(".theme-inspector cl-gradient-picker .cl-gradient-stop")
              .last()
              .trigger("pointerdown", {
                button: 0,
                pointerId: 10,
                clientX: rect.left + rect.width * 0.25,
                clientY: rect.top + rect.height / 2,
              });
            cy.wrap($rail)
              .trigger("pointermove", {
                pointerId: 10,
                clientX: rect.left + rect.width * 0.6,
                clientY: rect.top + rect.height / 2,
              })
              .trigger("pointerup", {
                pointerId: 10,
                clientX: rect.left + rect.width * 0.6,
                clientY: rect.top + rect.height / 2,
              });
          },
        );
        cy.get(".theme-inspector cl-gradient-picker .cl-gradient-stop")
          .last()
          .should("have.attr", "aria-label", "Gradient stop 3 at 60 percent");
        cy.get(".theme-inspector cl-layout-picker .cl-picker-trigger").click();
        cy.get(".theme-inspector cl-layout-picker .cl-picker-body")
          .find("label")
          .first()
          .should("contain", "Z-index");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("label", "Z-index")
          .find("input")
          .clear()
          .type("25");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("label", "Position")
          .find("select")
          .select("fixed");
        cy.get(".theme-inspector cl-layout-picker .cl-spacing-top")
          .find("cl-unit-input select")
          .select("vh");
        cy.get(
          ".theme-inspector cl-layout-picker .cl-spacing-right input[type='number']",
        )
          .click()
          .clear()
          .type("14");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("label", "Move X")
          .find("cl-unit-input select")
          .select("rem");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("label", "Rotate")
          .find("input[type='number']")
          .clear()
          .type("15");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("label", "Rotate")
          .find("input[type='range']")
          .should("exist");
        cy.get(".theme-inspector cl-layout-picker select")
          .first()
          .select("flex");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("Flex layout")
          .should("exist");
        cy.get(".theme-inspector cl-layout-picker select")
          .first()
          .select("grid");
        cy.get(".theme-inspector cl-layout-picker")
          .contains("Grid layout")
          .should("exist");
        cy.get(".theme-inspector cl-border-picker .cl-picker-trigger").click();
        cy.get(".theme-inspector cl-border-picker .cl-corner-icon").should(
          "have.length",
          4,
        );
        cy.get(
          ".theme-inspector cl-border-picker .cl-spacing-right input[type='number']",
        )
          .click()
          .clear()
          .type("3");
        cy.get(
          ".theme-inspector cl-border-picker .cl-spacing-top .cl-border-style-select",
        ).select("dashed");
        cy.get(".theme-inspector cl-border-picker .cl-picker-popover").then(
          ($popover) => {
            expect($popover[0].scrollWidth).to.be.at.most(
              $popover[0].clientWidth + 1,
            );
          },
        );
        cy.screenshot("theme-border-picker", { capture: "viewport" });
        cy.get(
          ".theme-inspector cl-border-picker .cl-spacing-top .cl-border-color-button",
        ).click();
        cy.get(
          ".theme-inspector cl-border-picker .cl-border-color-editor .cl-picker-swatches button",
        )
          .first()
          .click();
        cy.get(
          ".theme-inspector cl-animation-picker .cl-picker-trigger",
        ).click();
        cy.get(".theme-inspector cl-animation-picker")
          .contains("label", "Loop animation")
          .find("input[type='checkbox']")
          .check();
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='padding'] summary",
        ).click();
        cy.screenshot("theme-padding-picker", { capture: "viewport" });
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='padding'] .cl-spacing-top input",
        )
          .clear()
          .type("36")
          .blur();
        cy.get("iframe.theme-live-preview").should(($frame) => {
          expect($frame[0].contentDocument.body.style.paddingTop).eq("36px");
        });
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='padding'] .cl-spacing-right input[type='number']",
        )
          .click()
          .clear()
          .type("24");
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='padding'] .cl-spacing-bottom cl-unit-input select",
        ).select("rem");
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='margin'] summary",
        ).click();
        cy.get(
          ".theme-inspector cl-spacing-picker[kind='margin'] .cl-spacing-right input[type='number']",
        )
          .click()
          .clear()
          .type("12");
        cy.get(".theme-inspector cl-dimensions-picker summary").click();
        cy.get(".theme-inspector cl-dimensions-picker cl-unit-input")
          .first()
          .find("input[type='range']")
          .should("exist");
        cy.get(".theme-inspector cl-dimensions-picker cl-unit-input")
          .first()
          .find("select")
          .select("vw");
        cy.get(
          ".theme-inspector cl-dimensions-picker input[type='checkbox']",
        ).check();
        cy.get(".theme-inspector cl-dimensions-picker cl-unit-input")
          .eq(1)
          .find("select")
          .should("have.value", "auto");
        cy.get(".theme-inspector cl-dimensions-picker cl-unit-input")
          .eq(1)
          .find("input[type='number']")
          .clear()
          .type("360");
        cy.get(".theme-more summary").click();
        cy.get(".theme-more").contains("button", "Save Draft").click();
        cy.contains("Draft saved").should("exist");
        cy.request("/api/themes/" + body.id).then(({ body: theme }) => {
          expect(theme.draft.templates.default.settings.padding.top).eq(36);
          expect(theme.draft.templates.default.settings.padding.right).eq(24);
          expect(theme.draft.templates.default.settings.margin.right).eq(12);
          expect(theme.draft.templates.default.settings.borderSides.right).eq(
            3,
          );
          expect(theme.draft.templates.default.settings.offsets.right).eq(14);
          expect(theme.draft.templates.default.settings.maxWidth).match(/vw$/);
          expect(theme.draft.templates.default.settings.minHeight).eq(360);
          expect(theme.draft.templates.default.settings.padding.bottom).match(
            /rem$/,
          );
          expect(theme.draft.templates.default.settings.position).eq("fixed");
          expect(theme.draft.templates.default.settings.zIndex).eq(25);
          expect(theme.draft.templates.default.settings.offsets.top).match(
            /vh$/,
          );
          expect(theme.draft.templates.default.settings.transform.rotate).eq(
            15,
          );
          expect(theme.draft.templates.default.settings.color).eq("");
          expect(theme.draft.templates.default.settings.background).eq("");
          expect(theme.draft.templates.default.settings.borderStyles.top).eq(
            "dashed",
          );
          expect(theme.draft.templates.default.settings.borderColors.top).eq(
            "#214c3a",
          );
        });
      });
  });

  for (const kind of ["post", "page"]) {
    it(`uses the same pickers in the ${kind} Inspector`, () => {
      cy.visit(`/admin/${kind}s`);
      cy.contains("button", `Create ${kind}`).first().click();
      cy.get(".content-block-inspector cl-appearance-picker-panel").should(
        "exist",
      );
      for (const tag of [
        "cl-typography-picker",
        "cl-color-picker",
        "cl-gradient-picker",
        "cl-padding-picker",
        "cl-margin-picker",
        "cl-border-picker",
        "cl-animation-picker",
      ])
        cy.get(`.content-block-inspector ${tag}`).should("exist");
      cy.get(
        ".content-block-inspector cl-typography-picker .cl-picker-trigger",
      ).click();
      cy.get(
        ".content-block-inspector cl-typography-picker [aria-label='Bold']",
      ).click();
      cy.get(
        ".content-block-inspector cl-typography-picker [aria-label='Bold']",
      ).should("have.attr", "aria-pressed", "true");
      cy.get(".content-block-inspector cl-typography-picker")
        .contains("label", "Font size")
        .find("cl-unit-input select")
        .select("rem");
      cy.get(".content-block-inspector cl-typography-picker")
        .contains("label", "Font size")
        .find("cl-unit-input select")
        .should("have.value", "rem");
      cy.get(
        ".content-block-inspector cl-border-picker .cl-picker-trigger",
      ).click();
      cy.get(".content-block-inspector cl-border-picker .cl-corner-field")
        .first()
        .find("cl-unit-input select")
        .select("%");
      cy.get(
        ".content-block-inspector cl-animation-picker .cl-picker-trigger",
      ).click();
      cy.get(".content-block-inspector cl-animation-picker")
        .contains("label", "Duration")
        .find("cl-unit-input select")
        .select("s");
      cy.get(".content-block-inspector cl-animation-picker")
        .contains("label", "Duration")
        .find("cl-unit-input input[type='number']")
        .should("have.value", "0.5");
    });
  }
});
