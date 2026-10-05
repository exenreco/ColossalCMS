import { defineConfig } from "cypress";
export default defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:4201",
    specPattern: "tests/e2e/**/*.cy.mjs",
    supportFile: false,
  },
  fixturesFolder: "tests/fixtures",
  screenshotsFolder: ".local/cypress/screenshots",
  videosFolder: ".local/cypress/videos",
  video: false,
  viewportWidth: 1280,
  viewportHeight: 800,
});
