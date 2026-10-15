/** Add a native Contact template once without replacing an authored contact layout. */
export function upgradeGlossyContact(document) {
  const marker = "/* Glossy Contact template with Messaging */";
  if (document.css?.includes(marker)) return;
  const make = (type, settings = {}, children) => ({
    id: "glossy-contact-" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const form = () =>
    make("messaging/form", { columns: "2", classes: "c27-contact-form" });
  const contains = (node) =>
    node.type === "messaging/form" || node.children?.some(contains);
  if (!document.manifest.templates.some((t) => t.id === "contact"))
    document.manifest.templates.push({
      id: "contact",
      name: "Contact",
      file: "templates/contact.html",
      appliesTo: ["page"],
    });
  if (!document.templates.contact)
    document.templates.contact = make(
      "core/container",
      { classes: "c27-body" },
      [
        make("theme/part-header"),
        make(
          "core/columns",
          {
            classes: "c27-single-layout c27-page-layout c27-contact-layout",
            gap: 48,
            stackOnMobile: true,
            maxWidth: 1280,
          },
          [
            make(
              "core/column",
              { width: "2fr", classes: "c27-single-main c27-page-column" },
              [
                make("core/title", {
                  level: "h1",
                  fontSize: 36,
                  lineHeight: 44,
                  classes: "c27-page-title",
                }),
                make("core/paragraph", {
                  html: "Have a project in mind, a question, or something you’d like to share? Let’s start a conversation.",
                  fontSize: 16,
                  lineHeight: 26,
                  classes: "c27-contact-intro",
                }),
                make("core/post-content"),
                form(),
              ],
            ),
            make(
              "core/column",
              { width: "1fr", classes: "c27-single-sidebar c27-page-sidebar" },
              [make("theme/part-sidebar")],
            ),
          ],
        ),
        make("theme/part-footer"),
      ],
    );
  else if (!contains(document.templates.contact)) {
    const root = document.templates.contact;
    const target = root.children?.find((node) =>
      ["core/columns", "core/container", "core/column"].includes(node.type),
    );
    const main =
      target?.type === "core/columns"
        ? target.children?.find((node) => node.type === "core/column")
        : target;
    const parent = main || root;
    parent.children ||= [];
    parent.children.push(form());
  }
  document.css =
    (document.css || "") +
    `
${marker}
.theme-root .c27-contact-intro p{font-size:16px;line-height:26px;color:#a4a9b2;margin:0 0 28px}
.theme-root .c27-contact-form{margin-top:28px}
.theme-root .c27-contact-form .cl-messaging{background-color:#17191bc9;border-color:#ffffff20;backdrop-filter:blur(20px)}
.theme-root .c27-contact-form .cl-messaging h3{font-size:24px;line-height:32px;letter-spacing:-0.5px}
`;
  delete document.compiled;
}
