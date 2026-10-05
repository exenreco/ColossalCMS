export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: { type: string; attrs?: Record<string, any> }[];
  content?: RichNode[];
}
export interface ContentDetails {
  contentMain?: Record<string, unknown>;
  richText?: RichNode;
  contentBlocks?: import("./theme-models").BlockNode[];
  featuredImageId?: string;
  categories?: string[];
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  panelData?: Record<string, unknown>;
}
export interface Content {
  id: string;
  kind: "page" | "post";
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "pending" | "published" | "scheduled";
  publishAt: string;
  updatedAt: string;
  author: string;
  details?: ContentDetails;
  templateId?: string;
}
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  isCore: boolean;
  installed: boolean;
  active: boolean;
  icon: string;
  requires?: { colossal: string; plugins: string[] };
  admin: {
    entryComponent: string;
    menu: {
      label: string;
      icon: string;
      path: string;
      order?: number;
      group?: "main" | "system";
    };
    skeleton?: {
      component: string;
      variant: "table" | "grid" | "form" | "detail";
    };
  };
  frontend: {
    routes: { path: string; component: string }[];
    skeleton?: {
      component: string;
      variant: "table" | "grid" | "form" | "detail";
    };
  };
  runtime?: { entry: string };
  uploaded?: boolean;
  revision?: string;
  previousRevision?: string;
  pending?: boolean;
}
export interface Settings {
  title: string;
  tagline: string;
  accent: string;
  logo: string;
  announcement: string;
  siteIconId?: string;
  postRouting?: "home" | "page";
  postsPageId?: string;
  homePageId?: string;
  notFoundPageId?: string;
  routingVersion?: number;
}
export interface Member {
  id: string;
  email: string;
  role: "admin" | "editor";
}
export interface Activity {
  id: string;
  message: string;
  createdAt: string;
}
export interface MediaItem {
  id: string;
  type: "image" | "audio" | "video" | "model";
  name: string;
  altText: string;
  caption: string;
  description: string;
  tags: string[];
  url: string;
  thumbnailUrl?: string;
  mime: string;
  metadata: {
    meshCount?: number;
    triangleCount?: number;
    materialCount?: number;
    animationCount?: number;
    warnings?: string[];
    size: number;
    width?: number;
    height?: number;
    duration?: number;
  };
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
}
export interface State {
  user: Member;
  content: Content[];
  activeTheme?: { manifest: import("./theme-models").ThemeManifest };
  plugins: Plugin[];
  settings: Settings;
  members: Member[];
  activity: Activity[];
  media: MediaItem[];
  notices: { id: string; message: string; created_at: string }[];
  keys: { id: string; name: string; createdAt: string }[];
}
