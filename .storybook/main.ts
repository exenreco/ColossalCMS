import type { StorybookConfig } from "@storybook/angular";
const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.ts"],
  framework: { name: "@storybook/angular", options: {} },
  addons: [],
  staticDirs: ["../tests/fixtures"],
  core: { disableTelemetry: true },
};
export default config;
