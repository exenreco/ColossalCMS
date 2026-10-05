import { manifests } from "../plugins/registry.mjs";
export const catalog = manifests;
export const defaultSettings = {
  title: "Colossal Journal",
  tagline: "A space for ideas worth sharing.",
  accent: "#246b50",
  logo: "",
  announcement: "Welcome to our corner of the internet.",
};
export const sampleContent = [
  {
    id: "welcome",
    kind: "post",
    title: "Good things start with a blank page",
    slug: "good-things-start",
    excerpt:
      "A new space for thoughtful ideas, useful discoveries, and the work in between.",
    body: "Every worthwhile project begins with a little curiosity. This journal is a place to follow that curiosity and share what we learn along the way.\n\nExpect considered ideas, practical notes, and an honest look at the process of building something meaningful.\n\nThis is sample content. Open Posts in your workspace to make this story your own.",
    status: "published",
  },
  {
    id: "about",
    kind: "page",
    title: "About us",
    slug: "about",
    excerpt: "A little about the people behind the work.",
    body: "We believe good work starts with clear thinking and a willingness to try.\n\nThis is your space to tell visitors who you are, what you do, and why it matters. Edit this sample page in your workspace.",
    status: "published",
  },
  {
    id: "next-chapter",
    kind: "post",
    title: "Notes on the next chapter",
    slug: "next-chapter",
    excerpt: "Some ideas need a little more room to grow.",
    body: "Start with the idea you cannot stop thinking about.\n\nThis sample draft is only visible in your workspace until you publish it.",
    status: "draft",
  },
];
