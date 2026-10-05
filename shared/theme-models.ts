export interface BlockNode {
  id: string;
  type: string;
  settings: Record<string, any>;
  children?: BlockNode[];
}
export interface BlockField {
  key: string;
  label: string;
  type: string;
  default?: any;
  options?: string[];
}
export interface BlockDefinition {
  type: string;
  label: string;
  category: string;
  description?: string;
  icon?: string;
  container?: boolean;
  fields: BlockField[];
  template?: string;
  pluginId?: string;
  legacy?: boolean;
  toolbar?: string[];
}
export interface ThemeTemplate {
  id: string;
  name: string;
  file: string;
  isDefault?: boolean;
  isTypeDefault?: boolean;
  appliesTo: string[];
}
export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  isCore: boolean;
  requires: { colossal: string };
  templates: ThemeTemplate[];
  parts: Record<string, string>;
  blocks: { type: string; file: string; icon?: string }[];
  assets: { styles: string[]; scripts: string[] };
  palette?: string[];
}
export interface ThemeDocument {
  notices?: string[];
  manifest: ThemeManifest;
  templates: Record<string, BlockNode>;
  parts: Record<string, BlockNode>;
  blocks: BlockDefinition[];
  html: Record<string, string>;
  css: string;
  assets: Record<string, { key: string; mime: string }>;
  compiled?: Record<string, string>;
}
export interface ThemeSummary {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  isCore: boolean;
  active: boolean;
  templates: ThemeTemplate[];
  revision: number;
  hasDraft: boolean;
}
export interface ThemeRecord extends ThemeSummary {
  published: ThemeDocument;
  draft: ThemeDocument | null;
  history: { id: string; version: string; created_at: string }[];
}
