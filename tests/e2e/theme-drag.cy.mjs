describe("Populated theme drag targets", () => {
  const origin = { Origin: "http://127.0.0.1:4201" };
  const heading = (id, text) => ({
    id,
    type: "core/heading",
    settings: { text, level: "h2" },
  });
  const container = (id, children) => ({
    id,
    type: "core/container",
    settings: { padding: { top: 18, right: 18, bottom: 18, left: 18 } },
    children,
  });
  let themeId;
  beforeEach(() => {
    cy.request({
      method: "POST",
      url: "/api/admin/setup",
      body: {},
      headers: origin,
      failOnStatusCode: false,
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          body: { revision: body.revision, name: "Drag regression" },
          headers: origin,
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.published;
        document.templates.default = container("drag-root", [
          container("group-a", [
            heading("a-one", "First item"),
            heading("a-two", "Second item"),
          ]),
          container("group-b", [heading("b-one", "Existing destination item")]),
          {
            id: "columns",
            type: "core/columns",
            settings: { gap: 24 },
            children: [
              {
                id: "col-left",
                type: "core/column",
                settings: { width: "1fr" },
                children: [heading("col-one", "Left column")],
              },
              {
                id: "col-right",
                type: "core/column",
                settings: { width: "1fr" },
                children: [heading("col-two", "Right column")],
              },
            ],
          },
        ]);
        cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          body: { revision: body.revision, document },
          headers: origin,
        });
      });
  });
  const body = () =>
    cy
      .get(".theme-live-preview")
      .its("0.contentDocument.body")
      .should("not.be.empty");
  function dragInCanvas(sourceId, targetId, side = "after") {
    const transfer = new DataTransfer();
    body()
      .find('[data-block-id="' + sourceId + '"]')
      .click("center");
    body()
      .find(
        '[data-block-id="' +
          sourceId +
          '"] > .cl-block-toolbar [aria-label="Move block"]',
      )
      .should("have.attr", "draggable", "true")
      .trigger("dragstart", { dataTransfer: transfer });
    body()
      .find('[data-block-id="' + targetId + '"]')
      .then((el) => {
        const node = el[0],
          doc = node.ownerDocument,
          rect = node.getBoundingClientRect();
        const point = {
          clientX: side === "left" ? rect.left + 3 : rect.left + rect.width / 2,
          clientY: side === "before" ? rect.top + 3 : rect.bottom - 3,
        };
        expect(doc.elementFromPoint(point.clientX, point.clientY)).not.to.eq(
          null,
        );
        const Event = doc.defaultView.DragEvent;
        node.dispatchEvent(
          new Event("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            ...point,
          }),
        );
        const marker = doc.querySelector(".cl-drop-indicator");
        expect(marker.hidden).eq(false);
        const original = node.getBoundingClientRect();
        for (let i = 0; i < 8; i++)
          node.dispatchEvent(
            new Event("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer: transfer,
              ...point,
            }),
          );
        expect(node.getBoundingClientRect().top).eq(original.top);
        expect(node.getBoundingClientRect().height).eq(original.height);
        node.dispatchEvent(
          new Event("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            ...point,
          }),
        );
        expect(marker.hidden).eq(true);
      });
  }
  it("moves existing blocks into occupied containers, reorders them, and uses tree indexes in columns", () => {
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
      },
    });
    body().find('[data-block-id="b-one"]').should("exist");
    dragInCanvas("a-one", "b-one");
    const order = (selector, ids) =>
      cy.get(".theme-live-preview").should((frame) => {
        const nodes = frame[0].contentDocument.querySelectorAll(selector);
        expect([...nodes].map((n) => n.dataset.blockId)).deep.eq(ids);
      });
    order('[data-block-id="group-b"] > [data-block-id]', ["b-one", "a-one"]);
    dragInCanvas("a-one", "b-one", "before");
    order('[data-block-id="group-b"] > [data-block-id]', ["a-one", "b-one"]);
    dragInCanvas("a-two", "col-two", "before");
    order('[data-block-id="col-right"] > [data-block-id]', [
      "a-two",
      "col-two",
    ]);
    cy.get(".theme-more summary").click();
    cy.get(".theme-more").contains("button", "Save Draft").click();
    cy.get(".theme-more summary").click();
    cy.contains("Draft saved").should("exist");
    cy.request("/api/themes/" + themeId).then(({ body: record }) => {
      const children = record.draft.templates.default.children;
      expect(children[0].children).to.have.length(0);
      expect(children[1].children.map((n) => n.id)).deep.eq(["a-one", "b-one"]);
      expect(children[2].children.map((n) => n.id)).deep.eq([
        "col-left",
        "col-right",
      ]);
      expect(children[2].children[1].children.map((n) => n.id)).deep.eq([
        "a-two",
        "col-two",
      ]);
    });
  });
  it("keeps the drag document attached when a pending render finishes, then refreshes on cancellation", () => {
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
      },
    });
    body().find('[data-block-id="a-one"]').click("center");
    let requested = false,
      originalDocument;
    cy.intercept("POST", "/api/themes/" + themeId + "/render", (request) => {
      requested = true;
      request.continue((response) => response.setDelay(800));
    }).as("pendingRender");
    cy.get(".theme-inspector")
      .contains("label", "Text")
      .find("input")
      .clear()
      .type("Edited before dragging");
    cy.wrap(null).should(() => expect(requested).eq(true));
    body().then((element) => {
      originalDocument = element.ownerDocument || element[0].ownerDocument;
    });
    const transfer = new DataTransfer();
    body()
      .find('[data-block-id="a-one"] [aria-label="Move block"]')
      .trigger("dragstart", { dataTransfer: transfer });
    cy.get(".theme-editor-panes").should("have.class", "is-dragging");
    cy.wait("@pendingRender");
    cy.window().then(
      (win) =>
        new Cypress.Promise((resolve) =>
          win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)),
        ),
    );
    cy.get(".theme-live-preview").then((frame) =>
      expect(frame[0].contentDocument).eq(originalDocument),
    );
    cy.get("body").trigger("keydown", { key: "Escape", force: true });
    cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
    cy.get(".theme-live-preview").should((frame) => {
      expect(frame[0].contentDocument).not.eq(originalDocument);
      expect(frame[0].contentDocument.body.textContent).contain(
        "Edited before dragging",
      );
    });
    cy.get('[aria-label="Outline"][role="radio"]').click();
    cy.get(".theme-outline").should("be.visible");
  });
  it("drags new drawer blocks repeatedly across the iframe and cancels without trapping the editor", () => {
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
        win.sessionStorage.setItem("colossal.inspector.open", "false");
      },
    });
    body().find('[data-block-id="b-one"]').should("exist");
    cy.get(".blocks-trigger").click();
    const pointer = (name, x, y) =>
      cy.document().then((doc) =>
        doc.dispatchEvent(
          new doc.defaultView.PointerEvent(name, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "mouse",
            button: 0,
            buttons: name === "pointerup" ? 0 : 1,
            clientX: x,
            clientY: y,
          }),
        ),
      );
    const begin = () =>
      cy
        .get('[data-library-block="core/heading"]')
        .last()
        .should("have.attr", "draggable", "false")
        .then((row) => {
          const rect = row[0].getBoundingClientRect();
          cy.wrap(row).trigger("pointerdown", {
            eventConstructor: "PointerEvent",
            pointerId: 1,
            button: 0,
            clientX: rect.left + 8,
            clientY: rect.top + 8,
          });
        });
    for (const [i, width] of [1280, 900].entries()) {
      cy.viewport(width, 900);
      begin();
      cy.get(".theme-live-preview").then((frame) => {
        const canvas = frame[0],
          rect = canvas.getBoundingClientRect();
        const block = canvas.contentDocument
          .querySelector('[data-block-id="b-one"]')
          .getBoundingClientRect();
        const x = rect.left + block.left + 30,
          y = rect.top + block.bottom - 3;
        pointer("pointermove", x, y);
        cy.get(".theme-editor-panes").should("have.class", "is-dragging");
        cy.get(".theme-live-preview").should((f) =>
          expect(
            f[0].contentDocument.querySelector(".cl-drop-indicator").hidden,
          ).eq(false),
        );
        pointer("pointerup", x, y);
      });
      cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
      cy.get(".theme-live-preview").should((frame) =>
        expect(
          frame[0].contentDocument.querySelectorAll(
            '[data-block-id="group-b"] > [data-block-id]',
          ).length,
        ).eq(i + 2),
      );
      cy.get(".blocks-trigger").should("have.attr", "aria-expanded", "true");
    }
    begin();
    pointer("pointermove", 600, 250);
    cy.get(".theme-editor-panes").should("have.class", "is-dragging");
    cy.get("body").trigger("keydown", { key: "Escape", force: true });
    pointer("pointerup", 600, 250);
    cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
    cy.get(".theme-live-preview").should((frame) =>
      expect(
        frame[0].contentDocument.querySelectorAll(
          '[data-block-id="group-b"] > [data-block-id]',
        ).length,
      ).eq(3),
    );
    cy.get(".blocks-trigger").click();
    cy.get('[aria-label="Outline"][role="radio"]').click();
    cy.get(".theme-outline").should("be.visible");
    cy.get(".theme-more summary").click();
    cy.get(".theme-more").contains("button", "Save Draft").click();
    cy.contains("Draft saved").should("exist");
  });
  it("keeps a nested outline target stable while dragging a new Container into it", () => {
    cy.viewport(1280, 900);
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
        win.sessionStorage.setItem("colossal.inspector.open", "false");
      },
    });
    cy.get('[aria-label="Outline"][role="radio"]').click();
    cy.get(".blocks-trigger").click();
    cy.get('[data-library-block="core/container"]')
      .last()
      .then((row) => {
        const rect = row[0].getBoundingClientRect();
        cy.wrap(row).trigger("pointerdown", {
          eventConstructor: "PointerEvent",
          pointerId: 1,
          button: 0,
          clientX: rect.left + 8,
          clientY: rect.top + 8,
        });
      });
    cy.get('[data-drop-parent="group-b"]')
      .last()
      .then((zone) => {
        const rect = zone[0].getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        let dragovers = 0;
        zone[0].addEventListener("dragover", () => dragovers++);
        cy.document().then((doc) => {
          for (let i = 0; i < 40; i++)
            doc.dispatchEvent(
              new doc.defaultView.PointerEvent("pointermove", {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                clientX: x,
                clientY: y,
              }),
            );
          expect(dragovers).eq(1);
          doc.dispatchEvent(
            new doc.defaultView.PointerEvent("pointerup", {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: "mouse",
              button: 0,
              buttons: 0,
              clientX: x,
              clientY: y,
            }),
          );
        });
      });
    cy.get('.theme-tree-node[data-outline-id="group-b"]')
      .find('.theme-tree-node[data-block-type="core/container"]')
      .should("have.length", 1);
    cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
    cy.get('.theme-tree-node[data-outline-id="group-b"]')
      .find('.theme-tree-node[data-block-type="core/container"]')
      .find(".theme-drop-zone")
      .last()
      .scrollIntoView()
      .then((zone) => {
        const destination = zone[0].getBoundingClientRect();
        const x = destination.left + destination.width / 2;
        const y = destination.top + destination.height / 2;
        cy.document().then((doc) => {
          const row = doc.querySelector(
            '.theme-tree-node[data-outline-id="group-a"] > .theme-tree-row',
          );
          expect(row.getAttribute("draggable")).eq("false");
          const origin = row.getBoundingClientRect();
          row.dispatchEvent(
            new doc.defaultView.PointerEvent("pointerdown", {
              bubbles: true,
              cancelable: true,
              pointerId: 2,
              pointerType: "mouse",
              button: 0,
              buttons: 1,
              clientX: origin.left + 12,
              clientY: origin.top + 12,
            }),
          );
          expect(
            doc
              .elementFromPoint(x, y)
              ?.closest(".theme-drop-zone,.theme-tree-row"),
          ).eq(zone[0]);
          const dispatch = (name) =>
            doc.dispatchEvent(
              new doc.defaultView.PointerEvent(name, {
                bubbles: true,
                cancelable: true,
                pointerId: 2,
                pointerType: "mouse",
                button: 0,
                buttons: name === "pointerup" ? 0 : 1,
                clientX: x,
                clientY: y,
              }),
            );
          dispatch("pointermove");
          expect(zone[0].classList.contains("over")).eq(true);
          dispatch("pointerup");
        });
      });
    cy.get('.theme-tree-node[data-outline-id="group-b"]')
      .find('.theme-tree-node[data-outline-id="group-a"]')
      .should("exist");
    cy.get(".theme-editor-panes").should("not.have.class", "is-dragging");
    cy.get(".blocks-trigger").click();
    cy.get('[aria-label="Canvas"][role="radio"]').click();
    cy.get(".theme-live-preview").should("be.visible");
  });
  it("keeps occupied outline drop zones stationary and accepts drops on populated container rows", () => {
    cy.visit("/admin/themes/edit/" + themeId, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem("colossal.block-library.open", "false");
      },
    });
    cy.get('[role="radio"][aria-label="Outline"]').click();
    cy.get(".blocks-trigger").then((button) => {
      if (button.attr("aria-expanded") !== "true") cy.wrap(button).click();
    });
    const transfer = new DataTransfer();
    cy.get('[data-library-block="core/heading"]')
      .first()
      .trigger("dragstart", { dataTransfer: transfer });
    cy.get('[data-drop-parent="group-b"][data-drop-index="1"]')
      .then((el) => {
        const height = el[0].getBoundingClientRect().height;
        cy.wrap(el)
          .trigger("dragover", { dataTransfer: transfer })
          .should("have.class", "over")
          .then((hover) => {
            expect(hover[0].getBoundingClientRect().height).eq(height);
          });
      })
      .trigger("drop", { dataTransfer: transfer });
    cy.get(
      '[data-outline-id="group-b"] > .theme-tree-children > cl-theme-block-tree',
    ).should("have.length", 2);
    cy.get('[data-library-block="core/spacer"]')
      .first()
      .trigger("dragstart", { dataTransfer: transfer });
    cy.get('[data-outline-id="group-b"] > .theme-tree-row')
      .trigger("dragover", { dataTransfer: transfer })
      .trigger("drop", { dataTransfer: transfer });
    cy.get(
      '[data-outline-id="group-b"] > .theme-tree-children > cl-theme-block-tree',
    ).should("have.length", 3);
    cy.get(".theme-more summary").click();
    cy.get(".theme-more").contains("button", "Save Draft").click();
    cy.get(".theme-more summary").click();
    cy.contains("Draft saved").should("exist");
  });
});
