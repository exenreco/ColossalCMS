import type { AdminExtension } from "../../shared/admin-extension-registry.service";
export const aiAdminExtensions: AdminExtension[] = [
  {
    id: "ai-assistant-editor",
    pluginId: "com.colossal.ai-assistant",
    slot: "editor-tools",
    load: () =>
      import("./editor-chat.component").then((m) => m.AiEditorChatComponent),
  },
];
