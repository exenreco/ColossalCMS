import { defaultTheme, validateDocument } from "./theme-engine.mjs";
import { upgradeColossal2027Document } from "./colossal-2027-ice-world.mjs";

export const COLOSSAL_2027_ID = "com.colossal.theme.colossal-2027";
const block = (type, settings = {}, children) => ({
  id: "blk_" + crypto.randomUUID(),
  type,
  settings,
  ...(children ? { children } : {}),
});
const box = (classes, children, settings = {}) =>
  block("core/container", { classes, ...settings }, children);
const text = (html, classes = "") => block("core/rich-text", { html, classes });
const heading = (value, level = "h2", classes = "") =>
  block("core/heading", { text: value, level, classes });
const part = (name) => block("theme/part-" + name);
const label = (n, title) =>
  text(`<p><span>${n}</span> ${title}</p>`, "c27-section-label");
const links = (html, classes = "") => text(html, "c27-links " + classes);
const card = (name, description, image, tags, href, n) =>
  box("c27-project", [
    text(
      `<a href="${href}" aria-label="Explore ${name}"><img src="/themes/colossal-2027/${image}.svg" alt="${name} interface concept" loading="lazy"></a>`,
      "c27-project-image",
    ),
    box("c27-project-info", [
      text(`<p class="c27-project-number">${n} / SELECTED WORK</p>`),
      heading(name, "h3"),
      text(`<p>${description}</p>`),
      text(`<p class="c27-tags">${tags}</p>`),
      links(`<a href="${href}">Explore project <span>↗</span></a>`),
    ]),
  ]);
const work = () =>
  box(
    "c27-section c27-work",
    [
      label("01", "SELECTED WORK"),
      box("c27-section-heading", [
        heading("Made with purpose."),
        text("<p>A few things I’ve built. A thousand details considered.</p>"),
      ]),
      box("c27-project-grid", [
        card(
          "Colossal CMS",
          "A flexible publishing platform, built around people and their ideas.",
          "project-cms",
          "Angular · Node.js · MongoDB",
          "https://github.com/exenreco/ColossalCMS",
          "01",
        ),
        card(
          "Forma Studio",
          "An editorial portfolio concept where clarity meets a little curiosity.",
          "project-forma",
          "Design systems · Interaction · Concept",
          "/#contact",
          "02",
        ),
        card(
          "Orbit Workspace",
          "A calm dashboard concept for making complex work feel simple.",
          "project-orbit",
          "Interface design · Accessibility · Concept",
          "/#contact",
          "03",
        ),
      ]),
    ],
    { anchor: "work" },
  );
const about = () =>
  box(
    "c27-section c27-about",
    [
      label("02", "THE PERSON BEHIND THE PIXELS"),
      box("c27-about-grid", [
        heading("Curiosity is the starting point.\nCraft is the difference."),
        box("c27-about-copy", [
          text(
            "<p>I’m Exenreco Bell, a web developer who enjoys turning complex ideas into clear, useful experiences. I work across the interface and the systems behind it.</p>",
          ),
          text(
            "<p>With an associate degree and a bachelor’s degree, I bring a foundation of technical thinking and a constant appetite for what’s next.</p>",
          ),
          text(
            '<p class="c27-tags">Thoughtful interfaces · Reliable systems · A little imagination</p>',
          ),
          links('<a href="/#resume">Explore my background <span>↗</span></a>'),
        ]),
      ]),
    ],
    { anchor: "about" },
  );
const resume = () =>
  box(
    "c27-section c27-resume",
    [
      label("03", "BACKGROUND & CAPABILITIES"),
      box("c27-section-heading", [
        heading("Always a student.\nAlways a builder."),
        text("<p>A foundation in technology. An eye for the experience.</p>"),
      ]),
      box("c27-resume-grid", [
        box(
          "c27-glass-card",
          [
            text('<p class="c27-small-label">EDUCATION / 01</p>'),
            heading("Bachelor’s degree", "h3"),
            text(
              '<p>Institution & graduation year</p><p class="c27-editable-note">Add your school, field of study, and dates in the Theme Editor.</p>',
            ),
          ],
          {
            glassEnabled: true,
            glassBlur: 20,
            background: "#ffffff08",
            radius: 24,
          },
        ),
        box(
          "c27-glass-card",
          [
            text('<p class="c27-small-label">EDUCATION / 02</p>'),
            heading("Associate degree", "h3"),
            text(
              '<p>Institution & graduation year</p><p class="c27-editable-note">Add your school, field of study, and dates in the Theme Editor.</p>',
            ),
          ],
          {
            glassEnabled: true,
            glassBlur: 20,
            background: "#ffffff08",
            radius: 24,
          },
        ),
        box(
          "c27-glass-card",
          [
            text('<p class="c27-small-label">THE TOOLKIT</p>'),
            heading("From first idea\nto final detail.", "h3"),
            text(
              "<p>TypeScript · Angular · Node.js<br>MongoDB · Three.js · HTML & CSS</p>",
            ),
          ],
          {
            glassEnabled: true,
            glassBlur: 20,
            background: "#ffffff08",
            radius: 24,
          },
        ),
      ]),
    ],
    { anchor: "resume" },
  );
const contact = () =>
  box(
    "c27-section c27-contact",
    [
      label("04", "LET’S MAKE SOMETHING MATTER"),
      heading("A good idea starts\nwith a conversation."),
      text(
        "<p>Have a project in mind, an interesting problem, or a new possibility?</p>",
      ),
      links(
        '<a class="c27-cta" href="https://github.com/exenreco">Find me on GitHub <span>↗</span></a><a class="c27-secondary" href="/admin/">Manage this portfolio <span>↗</span></a>',
      ),
    ],
    {
      anchor: "contact",
      glassEnabled: true,
      glassBlur: 24,
      background: "#ffffff06",
      radius: 32,
    },
  );

export function colossal2027Theme() {
  const d = defaultTheme();
  Object.assign(d.manifest, {
    id: COLOSSAL_2027_ID,
    homeTemplate: "home",
    name: "Colossal 2027",
    isCore: true,
    author: "Colossal CMS",
    description:
      "An expressive portfolio in silver and liquid glass. A full-screen ice throne meets a moonlit Three.js landscape with wind and snow.",
    palette: ["#0c0d10", "#f1f2f4", "#9ca1aa", "#c5e5ff", "#ffffff14"],
    loading: {
      background: "#0c0d10",
      color: "#f1f2f4",
      accent: "#c5e5ff",
      animation: "pulse",
    },
  });
  d.parts.header = box(
    "c27-header-inner",
    [
      links(
        '<a class="c27-brand" href="/" aria-label="Exenreco Bell home"><span class="c27-brand-monogram">eb.</span><span>EXENRECO BELL<br><span class="c27-brand-subtitle">DEVELOPER & CREATIVE THINKER</span></span></a>',
      ),
      links(
        '<nav aria-label="Portfolio navigation"><a href="/#work">Work</a><a href="/#about">About</a><a href="/#resume">Background</a><a class="c27-nav-contact" href="/#contact">Let’s talk <span>↗</span></a></nav>',
      ),
    ],
    {
      glassEnabled: true,
      glassBlur: 28,
      glassSaturation: 130,
      background: "#17191bc9",
      radius: 22,
    },
  );
  const footerColumn = (children) =>
    block("core/column", { width: "1fr" }, children);
  d.parts.footer = box("c27-footer", [
    block(
      "core/columns",
      { classes: "c27-footer-grid", gap: 48, stackOnMobile: true },
      [
        footerColumn([
          heading("Exenreco Bell", "h3"),
          text(
            '<p>Thoughtful development.<br>Extraordinary possibilities.</p><p class="c27-small-label">COLOSSAL 2027 / PORTFOLIO</p>',
          ),
        ]),
        footerColumn([
          heading("Explore", "h3"),
          links(
            '<p><a href="/#work">Selected work</a></p><p><a href="/#about">About me</a></p><p><a href="/#resume">Background</a></p>',
          ),
        ]),
        footerColumn([
          heading("Connect", "h3"),
          links(
            '<p><a href="https://github.com/exenreco">GitHub ↗</a></p><p><a href="/#contact">Start a conversation ↗</a></p><p><a href="/admin/">Portfolio workspace ↗</a></p>',
          ),
        ]),
      ],
    ),
    text(
      "<p>© {{year}} Exenreco Bell. Built with care. <span>Powered by Colossal CMS</span></p>",
      "c27-footer-bottom",
    ),
  ]);
  for (const root of Object.values(d.templates)) {
    root.settings = { classes: "c27-body" };
    if (root.children[1]) root.children[1].settings.classes = "c27-article";
  }
  const hero = box("c27-hero", [
    box("c27-hero-copy", [
      text(
        '<p class="c27-availability"><span>●</span> OPEN TO WHAT’S NEXT</p>',
      ),
      text('<p class="c27-hero-eyebrow">EXENRECO BELL / WEB DEVELOPER</p>'),
      heading("Ideas into\ninterfaces.\nCode into\nexperiences.", "h1"),
      text(
        "<p>I build considered digital experiences.<br>From the first interaction to the last detail.</p>",
        "c27-hero-description",
      ),
      links(
        '<a class="c27-cta" href="/#work">Explore my work <span>↗</span></a><a class="c27-secondary" href="/#about">Meet the developer <span>→</span></a>',
        "c27-hero-actions",
      ),
      text(
        '<p class="c27-hero-footnote">A LITTLE CURIOSITY. A LOT OF CRAFT.</p>',
      ),
    ]),
    box("c27-hero-art", [
      block(
        "core/gltf",
        {
          source: "portrait",
          portraitUrl: "/themes/colossal-2027/ice-portrait.png",
          height: 690,
          alt: "Exenreco Bell sculpted in translucent ice, resting his hand against his cheek",
          ariaLabel:
            "Interactive ice portrait. Move the pointer or use arrow keys to explore the crystal scene.",
          fragmentCount: 20,
          pointerInteractive: true,
          motionStrength: 0.7,
          scrollInteractive: true,
          scrollStrength: 0.8,
          cameraZoom: 1.12,
          iceTint: "#c5e5ff",
          lightIntensity: 2.1,
          lazyLoad: false,
        },
        [],
      ),
      text(
        "<p><span>FIGURE 001 / FROZEN IN THOUGHT</span><span>MOVE TO EXPLORE ↗</span></p>",
        "c27-art-caption",
      ),
    ]),
  ]);
  d.templates.home = box("c27-body", [
    part("header"),
    hero,
    box("c27-intro-line", [
      text("<p>Built on curiosity. Shaped by precision.</p>"),
      text("<p>SCROLL TO DISCOVER <span>↓</span></p>"),
    ]),
    work(),
    about(),
    resume(),
    contact(),
    part("footer"),
  ]);
  for (const [id, name, sections] of [
    ["projects", "Projects", [work(), contact()]],
    ["resume", "Resume", [resume(), about(), contact()]],
  ]) {
    d.manifest.templates.push({
      id,
      name,
      file: `templates/${id}.html`,
      appliesTo: ["page"],
    });
    d.templates[id] = box("c27-body", [
      part("header"),
      ...sections,
      part("footer"),
    ]);
  }
  d.css = `
.theme-root.c27-body{margin:0;display:flow-root;background-color:#0c0d10;background-image:radial-gradient(ellipse at 78% 12%,#20253144,transparent 42%);color:#f1f2f4;font-family:Arial,Helvetica,sans-serif;line-height:1.7}
.theme-root.c27-body *{box-sizing:border-box}
.theme-root.c27-body p{margin:0 0 18px}
.theme-root.c27-body a{color:inherit;text-decoration:none;transition:color .2s,background-color .2s,transform .2s}
.theme-root.c27-body a:hover{color:#c5e5ff}
.theme-root.c27-body a:focus-visible{outline:2px solid #c5e5ff;outline-offset:6px}
.theme-root.c27-body h1,.theme-root.c27-body h2,.theme-root.c27-body h3{font-family:Arial,Helvetica,sans-serif;font-weight:500;line-height:1.1;color:#f1f2f4;letter-spacing:-2px;white-space:pre-line}
.theme-root.c27-body h1{font-size:clamp(58px,6.8vw,98px);margin:0 0 32px;letter-spacing:-5px}
.theme-root.c27-body h2{font-size:clamp(36px,4.1vw,62px);margin:0 0 24px;letter-spacing:-2.5px}
.theme-root.c27-body h3{font-size:28px;margin:0 0 18px;letter-spacing:-1px}
.theme-root .theme-part-header{position:sticky;top:18px;z-index:100;max-width:1280px;padding:0 32px;margin:18px auto 0;border:0}
.theme-root .c27-header-inner{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border:1px solid #ffffff24;box-shadow:0 12px 44px #00000035;gap:24px}
.theme-root .c27-header-inner p{margin:0}
.theme-root .c27-brand{display:flex;gap:14px;align-items:center;font-size:10px;font-weight:700;letter-spacing:1.4px;line-height:1.7}
.theme-root .c27-brand-monogram{font-size:38px;letter-spacing:-3px;font-weight:500;line-height:1}
.theme-root .c27-brand-subtitle{font-size:8px;color:#9297a0;letter-spacing:1.3px}
.theme-root .c27-header-inner nav{display:flex;align-items:center;gap:32px;font-size:12px;color:#b7bbc4}
.theme-root .c27-nav-contact{padding:10px 18px;border:1px solid #ffffff30;border-radius:12px;background-color:#ffffff0d;color:#fff;white-space:nowrap}
.theme-root .c27-hero{display:grid;grid-template-columns:1.02fr 1fr;align-items:center;max-width:1280px;margin:0 auto;padding:26px 48px 20px;gap:14px;min-height:760px}
.theme-root .c27-hero-copy{padding:32px 0 20px}
.theme-root .c27-availability{font-size:9px;letter-spacing:1.6px;color:#b9c4c9;display:flex;align-items:center;gap:8px;margin-bottom:36px}
.theme-root .c27-availability span{color:#c5e5ff;font-size:9px}
.theme-root .c27-hero-eyebrow{font-size:10px;letter-spacing:2px;color:#a4a9b2;margin-bottom:24px}
.theme-root .c27-hero-description{font-size:14px;color:#9399a4;line-height:1.9;margin-bottom:26px}
.theme-root .c27-hero-actions,.theme-root .c27-contact .c27-links{display:flex;flex-wrap:wrap;gap:24px;align-items:center}
.theme-root .c27-cta{display:inline-flex;align-items:center;justify-content:space-between;gap:32px;padding:15px 22px;border-radius:14px;background-image:linear-gradient(140deg,#f2f4f7,#b6bcc6);color:#12151a!important;font-size:12px;font-weight:700;box-shadow:inset 0 1px 0 #ffffff80,0 7px 30px #00000035}
.theme-root .c27-cta:hover{transform:translateY(-3px)}
.theme-root .c27-secondary{font-size:12px;color:#c5c9d0;display:inline-flex;gap:16px;align-items:center;padding:15px 0}
.theme-root .c27-hero-footnote{margin-top:32px;font-size:8px;letter-spacing:1.8px;color:#626a75}
.theme-root .c27-hero-art{min-width:0;background-image:radial-gradient(ellipse at 52% 45%,#b7c9e518,transparent 65%)}
.theme-root .cl-portrait-scene{max-width:none;width:100%;line-height:0}
.theme-root .cl-portrait-fallback{width:100%;height:100%;object-fit:contain;display:block}
.theme-root .c27-art-caption p{display:flex;justify-content:space-between;gap:18px;font-size:7px;letter-spacing:1.6px;color:#7e8590;padding:0 8px;margin:0}
.theme-root .c27-intro-line{display:flex;justify-content:space-between;gap:24px;max-width:1184px;margin:0 auto;padding:28px 0;border-top:1px solid #ffffff16;border-bottom:1px solid #ffffff16;color:#737b89;font-size:12px}
.theme-root .c27-intro-line p{margin:0}
.theme-root .c27-intro-line p:last-child{font-size:9px;letter-spacing:2px}
.theme-root .c27-section{max-width:1184px;margin:0 auto;padding:96px 0;scroll-margin-top:140px}
.theme-root .c27-section-label{font-size:9px;letter-spacing:2px;color:#777f8d;margin-bottom:28px}
.theme-root .c27-section-label span{margin-right:20px;color:#c5e5ff}
.theme-root .c27-section-heading{display:flex;justify-content:space-between;align-items:end;gap:28px;margin-bottom:38px}
.theme-root .c27-section-heading p{max-width:270px;color:#858d9b;font-size:13px}
.theme-root .c27-project-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.theme-root .c27-project{border:1px solid #ffffff14;border-radius:24px;overflow:hidden;background-image:linear-gradient(160deg,#ffffff06,#ffffff02);transition:transform .3s,border-color .3s}
.theme-root .c27-project:hover{transform:translateY(-5px);border-color:#ffffff35}
.theme-root .c27-project-image{overflow:hidden;background-color:#181b21}
.theme-root .c27-project-image img{width:100%;height:260px;object-fit:cover;display:block;margin:0;transition:transform .4s}
.theme-root .c27-project:hover img{transform:scale(1.04)}
.theme-root .c27-project-info{padding:28px}
.theme-root .c27-project-info p{font-size:12px;color:#8b93a1}
.theme-root .c27-project-info h3{font-size:25px}
.theme-root .c27-project-info .c27-project-number{font-size:8px;letter-spacing:1.8px;color:#646e7c}
.theme-root .c27-tags{font-size:10px!important;color:#adb5c2!important;line-height:2}
.theme-root .c27-project-info .c27-links a{display:flex;justify-content:space-between;font-size:11px;color:#d2d7df;padding-top:12px}
.theme-root .c27-about{border-top:1px solid #ffffff14;border-bottom:1px solid #ffffff14}
.theme-root .c27-about-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:100px}
.theme-root .c27-about-copy p{color:#8e97a5;font-size:14px;line-height:1.95}
.theme-root .c27-about-copy .c27-links a{font-size:12px;color:#c5e5ff}
.theme-root .c27-resume-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.theme-root .c27-glass-card{padding:32px;border:1px solid #ffffff20;background-image:linear-gradient(130deg,#ffffff06,transparent)}
.theme-root .c27-glass-card p{font-size:13px;color:#919ba9}
.theme-root .c27-small-label{font-size:8px!important;letter-spacing:1.8px;color:#717b8b!important}
.theme-root .c27-editable-note{font-size:10px!important;line-height:1.8}
.theme-root .c27-contact{margin:24px auto 100px;padding:64px;border:1px solid #ffffff22;background-image:radial-gradient(ellipse at 90% 0%,#899bb92b,transparent 75%)}
.theme-root .c27-contact p{color:#8e97a5;font-size:14px}
.theme-root .c27-contact .c27-links{margin-top:28px}
.theme-root .theme-part-footer{max-width:1280px;margin:0 auto;padding:0 48px;border:0}
.theme-root .c27-footer{border-top:1px solid #ffffff18;padding:56px 0 24px}
.theme-root .c27-footer-grid{max-width:none}
.theme-root .c27-footer h3{font-size:17px;letter-spacing:-.4px}
.theme-root .c27-footer p{font-size:12px;color:#717c8d}
.theme-root .c27-footer a{color:#a4adbb}
.theme-root .c27-footer-bottom{border-top:1px solid #ffffff10;margin-top:40px;padding-top:24px}
.theme-root .c27-footer-bottom p{display:flex;justify-content:space-between;gap:20px;font-size:9px;margin:0}
.theme-root .c27-article{max-width:1100px;margin:60px auto;padding:40px 32px;min-height:60vh}
.theme-root .c27-article .theme-post-grid article{background-color:#171a20;border:1px solid #ffffff18;border-radius:18px;padding:24px}
@media(max-width:1250px){.theme-root .c27-section,.theme-root .c27-intro-line{margin-left:48px;margin-right:48px}.theme-root .c27-about-grid{gap:48px}.theme-root .c27-hero{min-height:680px}.theme-root .c27-hero-art .gltf-viewer{height:600px!important}}
@media(max-width:850px){.theme-root .c27-header-inner nav{gap:18px}.theme-root .c27-brand-subtitle{display:none}.theme-root .c27-hero{grid-template-columns:1fr 1fr;padding:32px;min-height:630px}.theme-root.c27-body h1{font-size:60px;letter-spacing:-3px}.theme-root .c27-hero-art .gltf-viewer{height:520px!important}.theme-root .c27-project-grid,.theme-root .c27-resume-grid{grid-template-columns:1fr}.theme-root .c27-project{display:grid;grid-template-columns:1fr 1fr}.theme-root .c27-project-image img{height:100%;min-height:280px}.theme-root .c27-section{padding:64px 0}.theme-root .c27-about-grid{gap:32px}.theme-root .c27-contact{padding:40px}}
@media(max-width:600px){.theme-root .theme-part-header{padding:0 16px;top:10px;margin-top:10px}.theme-root .c27-header-inner{padding:14px 16px;gap:10px}.theme-root .c27-brand{font-size:8px;letter-spacing:.6px;gap:8px}.theme-root .c27-brand-monogram{font-size:30px}.theme-root .c27-header-inner nav{gap:14px;font-size:11px}.theme-root .c27-header-inner nav a:nth-child(2),.theme-root .c27-header-inner nav a:nth-child(3){display:none}.theme-root .c27-nav-contact{padding:7px 10px}.theme-root .c27-hero{display:flex;flex-direction:column;padding:28px 24px;gap:0}.theme-root .c27-hero-copy{width:100%;padding:16px 0}.theme-root.c27-body h1{font-size:clamp(46px,16vw,64px)}.theme-root .c27-hero-art{width:100%}.theme-root .c27-hero-art .gltf-viewer{height:460px!important}.theme-root .c27-hero-footnote{margin-top:18px}.theme-root .c27-availability{margin-bottom:24px}.theme-root .c27-art-caption p{font-size:6px}.theme-root .c27-section,.theme-root .c27-intro-line{margin-left:24px;margin-right:24px}.theme-root .c27-section-heading,.theme-root .c27-about-grid{display:block}.theme-root .c27-section-heading p{max-width:none}.theme-root .c27-project{display:block}.theme-root .c27-project-image img{height:250px;min-height:0}.theme-root .c27-about-copy{margin-top:32px}.theme-root .c27-contact{padding:28px;margin-bottom:64px}.theme-root .c27-contact h2{font-size:38px}.theme-root .theme-part-footer{padding:0 24px}.theme-root .c27-footer-bottom p{display:block}.theme-root .c27-footer-bottom span{display:block;margin-top:8px}.theme-root .c27-intro-line{font-size:10px;gap:16px}.theme-root .c27-intro-line p:last-child{font-size:7px;letter-spacing:1px}}
@media(prefers-reduced-motion:reduce){.theme-root.c27-body a,.theme-root .c27-project,.theme-root .c27-project-image img{transition:none}.theme-root .c27-project:hover,.theme-root .c27-project:hover img,.theme-root .c27-cta:hover{transform:none}}
`;
  return validateDocument(upgradeColossal2027Document(d), true);
}
