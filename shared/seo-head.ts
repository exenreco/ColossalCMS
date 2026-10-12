/** Replace owned metadata during frontend navigation without injecting HTML. */
export function syncSeoHead(seo: any) {
  document.head
    .querySelectorAll("[data-cms-seo]")
    .forEach((node) => node.remove());
  if (!seo) return;
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = seo.canonical;
  canonical.dataset["cmsSeo"] = "";
  document.head.appendChild(canonical);
  const add = (name: string, content: string, attribute = "property") => {
    const node = document.createElement("meta");
    node.setAttribute(attribute, name);
    node.content = content;
    node.dataset["cmsSeo"] = "";
    document.head.appendChild(node);
  };
  add("robots", seo.robots, "name");
  add("og:title", seo.socialTitle);
  add("og:description", seo.socialDescription);
  add("og:url", seo.canonical);
  add("og:type", seo.type);
  add("og:site_name", seo.siteName);
  add("twitter:card", seo.image ? "summary_large_image" : "summary", "name");
  add("twitter:title", seo.socialTitle, "name");
  add("twitter:description", seo.socialDescription, "name");
  if (seo.image) {
    add("og:image", seo.image);
    add("twitter:image", seo.image, "name");
  }
  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.dataset["cmsSeo"] = "";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": seo.graph,
  });
  document.head.appendChild(schema);
}
