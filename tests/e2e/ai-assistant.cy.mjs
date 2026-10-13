describe("AI Assistant provider settings and undoable editor proposals", () => {
  const headers = { Origin: "http://127.0.0.1:4201" };
  let themeId;
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
      url: "/api/admin/plugins",
      headers,
      body: { id: "com.colossal.ai-assistant", action: "install" },
    });
    cy.request({
      method: "PUT",
      url: "/api/admin/editor/preferences",
      headers,
      body: { walkthroughVersion: 1 },
    });
    cy.request("/api/themes/com.colossal.theme.default")
      .then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/themes/com.colossal.theme.default/clone",
          headers,
          body: { revision: body.revision, name: "AI regression" },
        }),
      )
      .then(({ body }) => {
        themeId = body.id;
        return cy.request("/api/themes/" + themeId);
      })
      .then(({ body }) => {
        const document = body.published;
        document.templates.home = {
          id: "ai-root",
          type: "core/container",
          settings: {},
          children: [
            {
              id: "ai-paragraph",
              type: "core/paragraph",
              settings: { html: "Original copy" },
            },
          ],
        };
        return cy.request({
          method: "PUT",
          url: "/api/themes/" + themeId + "/draft",
          headers,
          body: { revision: body.revision, document },
        });
      });
  });
  it("automatically discovers models without manual model controls", () => {
    cy.intercept("POST", "/api/admin/ai-assistant/models", (req) =>
      req.reply({
        provider: req.body.provider,
        models: [
          { id: "test-model", label: "Test model" },
          { id: "test-advanced", label: "Advanced" },
        ],
        truncated: false,
      }),
    ).as("modelQuery");
    cy.viewport(1440, 900);
    cy.visit("/admin/ai-assistant");
    cy.get('input[name="enabled"]').check();
    cy.get('select[name="provider"]').should("have.value", "").select("openai");
    cy.get('input[name="queryModels"]').should("not.exist");
    cy.get('input[name="openaiModel"]').should("not.exist");
    cy.get('input[name="openaiKey"]').type("e2e-fake-provider-key").blur();
    cy.wait("@modelQuery");
    cy.contains('[role="status"]', "2 models available").should("be.visible");
    cy.contains("button", "Save AI settings").click();
    cy.contains('[role="status"]', "AI Assistant settings saved.").should(
      "be.visible",
    );
    cy.get('input[name="openaiKey"]').should("have.value", "");
    cy.reload();
    cy.wait("@modelQuery");
    cy.get('select[name="provider"]').should("have.value", "openai");
    cy.get('select[name="provider"]').select("anthropic");
    cy.get('input[name="anthropicModel"]').should("not.exist");
    cy.get('input[name="anthropicKey"]').type("e2e-fake-anthropic-key").blur();
    cy.wait("@modelQuery");
    cy.get('select[name="provider"]').select("openai");
    cy.wait("@modelQuery");
    cy.contains('[role="status"]', "2 models available").should("be.visible");
    cy.screenshot("ai-assistant-auto-models", { capture: "viewport" });
  });
  it("previews, applies and undoes one batch and rejects stale proposals", () => {
    cy.intercept("GET", "/api/admin/ai-assistant/models", {
      provider: "openai",
      models: [
        { id: "test-model", label: "Test model" },
        { id: "test-advanced", label: "Advanced model" },
      ],
      truncated: false,
    });
    cy.intercept("GET", "/api/admin/ai-assistant/status", {
      enabled: true,
      configured: true,
      provider: "openai",
      model: "test-model",
    });
    cy.intercept("POST", "/api/admin/ai-assistant/chat", (req) =>
      req.reply({
        headers: { "Content-Type": "application/x-ndjson" },
        body:
          JSON.stringify({
            type: "proposal",
            message: "Update the paragraph and add a heading.",
            revision: req.body.context.revision,
            commands: [
              {
                type: "update",
                id: "ai-paragraph",
                settings: { html: "Updated by assistant" },
              },
              {
                type: "insert",
                blockType: "core/heading",
                parentId: "ai-root",
                index: 0,
                settings: { text: "AI heading", level: "h2" },
              },
            ],
          }) + "\n",
      }),
    );
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get("button.ai-trigger").should("be.visible").click();
    cy.get("#ai-prompt").type("Improve the introduction");
    cy.contains(".ai-chat button", "Send").click();
    cy.contains(".ai-preview", "Proposed changes").should("be.visible");
    cy.get("iframe.theme-live-preview")
      .its("0.contentDocument.body")
      .should("contain.text", "Original copy")
      .and("not.contain.text", "AI heading");
    cy.contains(".ai-chat button", "Apply changes").click();
    cy.contains('[role="status"]', "Changes applied as one undo step").should(
      "be.visible",
    );
    cy.get("iframe.theme-live-preview")
      .its("0.contentDocument.body")
      .should("contain.text", "Updated by assistant")
      .and("contain.text", "AI heading");
    cy.contains(".ai-chat button", "Undo").click();
    cy.get("iframe.theme-live-preview")
      .its("0.contentDocument.body")
      .should("contain.text", "Original copy")
      .and("not.contain.text", "AI heading");
    cy.get("#ai-prompt").type("Improve again");
    cy.contains(".ai-chat button", "Send").click();
    cy.contains(".ai-preview", "Proposed changes").should("be.visible");
    cy.window().then(async (win) => {
      await win.colossalThemeEditor.dispatch({
        type: "rename",
        id: "ai-paragraph",
        label: "Changed while reviewing",
      });
    });
    cy.contains(".ai-chat button", "Apply changes").click();
    cy.contains('[role="alert"]', "The document changed").should("be.visible");
    cy.get("iframe.theme-live-preview")
      .its("0.contentDocument.body")
      .should("contain.text", "Original copy");
    cy.screenshot("ai-assistant-stale-preview", { capture: "viewport" });
  });
  it("uses composer mode/model/context menus and keeps discussion separate from changes", () => {
    cy.intercept("GET", "/api/admin/ai-assistant/models", {
      provider: "openai",
      models: [
        { id: "test-model", label: "Test model" },
        { id: "test-advanced", label: "Advanced model" },
      ],
      truncated: false,
    });
    cy.intercept("GET", "/api/admin/ai-assistant/status", {
      enabled: true,
      configured: true,
      provider: "openai",
      model: "test-model",
      models: [
        { provider: "openai", model: "test-model", label: "OpenAI" },
        { provider: "anthropic", model: "test-advanced", label: "Anthropic" },
      ],
    });
    cy.intercept("POST", "/api/admin/ai-assistant/chat", (req) => {
      expect(req.body.mode).to.equal("plan");
      expect(req.body.provider).to.equal("openai");
      expect(req.body.model).to.equal("test-advanced");
      expect(req.body.attachments[0].id).to.equal("ai-paragraph");
      req.reply({
        headers: { "Content-Type": "application/x-ndjson" },
        body:
          JSON.stringify({
            type: "proposal",
            message: "Here is a plan for the introduction.",
            commands: [],
            revision: req.body.context.revision,
          }) + "\n",
      });
    }).as("planRequest");
    cy.viewport(1440, 900);
    cy.visit("/admin/themes/edit/" + themeId);
    cy.get("button.ai-trigger").click();
    cy.get(".ai-chat")
      .should("be.visible")
      .then(($chat) => {
        const rect = $chat[0].getBoundingClientRect();
        expect(rect.bottom).to.be.lessThan(900);
        expect(rect.width).to.be.at.most(640);
      });
    cy.get('[aria-label="Assistant mode"]').click();
    cy.get('[role="menuitemradio"]').contains("Plan").click();
    cy.get('[aria-label="Assistant mode"]').should("contain.text", "Plan");
    cy.get('[aria-label="Assistant model"]').click();
    cy.get('[role="menuitemradio"]').contains("test-advanced").click();
    cy.get('[aria-label="Assistant model"]').should(
      "contain.text",
      "test-advanced",
    );
    cy.get("#ai-prompt").type("@");
    cy.get('[aria-label="Search context"]').type("ai-paragraph");
    cy.get(".ai-context-results button").first().click();
    cy.get(".ai-chip").should("be.visible");
    cy.get("#ai-prompt").type("Plan the introduction{enter}");
    cy.wait("@planRequest");
    cy.get(".ai-chat-log").should("contain.text", "Here is a plan");
    cy.get(".ai-preview").should("not.exist");
    cy.get('[aria-label="Minimize conversation"]').click();
    cy.get(".ai-conversation").should("not.exist");
    cy.contains(".ai-chat button", "Show chat").click();
    cy.get(".ai-conversation").should("be.visible");
    cy.get('[aria-label="New chat"]').click();
    cy.get(".ai-conversation").should("not.exist");
    cy.get("#ai-prompt").should("have.value", "");
    cy.viewport(1280, 720);
    cy.screenshot("ai-assistant-composer", { capture: "viewport" });
    cy.get('[aria-label="Close assistant bar"]').click();
    cy.get(".ai-chat").should("not.exist");
  });
});
