// Editorial source: Resume 2025.pdf and public exenreco GitHub repositories.
// Employment dates are a 2025 snapshot, not confirmation of current employment.
import { enrichSeo } from "./seo-content.mjs";
export const identity = {
  name: "Exenreco Bell",
  email: "exenreco19@yahoo.com",
  location: "Omaha, Nebraska",
  github: "https://github.com/exenreco",
};
export const pillars = [
  {
    slug: "web-development",
    title: "Web Development",
    summary: "Interfaces, publishing systems and WordPress experiences.",
    sections: [
      [
        "Building for the web",
        "My web development practice brings together front-end interfaces, content publishing and the systems that support them. My 2025 resume lists JavaScript, React, jQuery, Backbone, HTML, XML, CSS, PHP and WordPress. My public repositories also show work with Angular and TypeScript.",
      ],
      [
        "Publishing and content management",
        "Colossal CMS explores block-based publishing with separate Angular administration and public applications. Its shared API, themes and extensions connect content editing to the visitor experience. The Rhythmz repositories explore WordPress block-based development around The Events Calendar Pro.",
      ],
      [
        "Learning through applications",
        "Athena’s Expense Tracking System is a collaborative WEB 450 course project. My repositories for Node.js, RESTful APIs, NoSQL and Angular document the wider learning behind this work. These are educational projects rather than commercial client engagements.",
      ],
      [
        "Explore related projects",
        '<a href="/projects/colossal-cms/">Colossal CMS</a> · <a href="/projects/rhythmz-wordpress/">Rhythmz WordPress</a> · <a href="/projects/expense-tracking-system/">Expense Tracking System</a> · <a href="/projects/portfolio-evolution/">Portfolio evolution</a>',
      ],
    ],
  },
  {
    slug: "technical-systems",
    title: "Technical Systems",
    summary: "IT experience, infrastructure and hands-on problem solving.",
    sections: [
      [
        "From engineering to IT",
        "My background includes mechanical engineering, electronics and information technology studies in Jamaica, followed by web development education in Nebraska. That mix connects practical troubleshooting with the structured thinking needed to build software.",
      ],
      [
        "Professional experience",
        "My 2025 resume records a Director of IT and Web Developer role at Care Builders at Home from February 2019 to 2022. It also records a Technical Engineer role at Fiserv beginning in October 2023 and continuing at the time of that resume. These entries describe my career background without asserting unverified current employment.",
      ],
      [
        "The home lab",
        "My home lab includes Dell R6515 and R7515 servers running Proxmox to host websites and other web services. A three-tier network uses UniFi switches and a UDM Pro. The lab gives me a practical environment for exploring the relationship between applications, servers and networking.",
      ],
      [
        "Connecting infrastructure and development",
        'Web applications rely on more than the interface. Colossal CMS provides a concrete example of that relationship through its local SQLite development setup and documented production database and storage options. <a href="/projects/colossal-cms/">Explore the CMS project</a> or <a href="/background/">read my background</a>.',
      ],
    ],
  },
  {
    slug: "creative-practice",
    title: "Creative Practice",
    summary: "Graphic design, photography and making in three dimensions.",
    sections: [
      [
        "An eye for the finished experience",
        "My 2025 resume describes my work across web development, graphic design and technical practice. Visual arts and technical drawing are part of my earlier education. I bring those interests into how I think about websites and digital experiences.",
      ],
      [
        "Photography and image work",
        "Photography includes taking and manipulating images for clients and relatives. It is another way to practice composition, visual communication and attention to detail. A dedicated photography gallery can grow here as approved images become available.",
      ],
      [
        "3D creation and printing",
        "I create and print parts and tools for my home and home lab. This hands-on work links mechanical thinking to design: an idea needs to function in a physical setting as well as look convincing on screen.",
      ],
      [
        "Digital presentation",
        'My portfolio repositories document different approaches to presenting work, including a WordPress portfolio and an Angular-based 2026 portfolio. <a href="/projects/portfolio-evolution/">Explore the portfolio evolution</a> and <a href="/about/">meet the person behind the work</a>.',
      ],
    ],
  },
];
export const projects = [
  {
    slug: "colossal-cms",
    title: "Colossal CMS",
    category: "Web Development",
    tags: ["Angular", "JavaScript", "Node.js", "CMS"],
    summary:
      "A block-based content management system with Angular administration, public rendering, themes and extensions.",
    repo: "ColossalCMS",
    sections: [
      [
        "The project",
        "Colossal CMS is a publishing platform for posts, pages, media, templates and team access. It separates the Angular administration and public applications while using a shared HTTP API.",
      ],
      [
        "How it is structured",
        "The repository documents native content blocks, declarative themes and bundled extensions. Local development uses SQLite and local files. Documented production options include MongoDB or Cloudflare D1, with GridFS, R2-compatible object storage or persistent local files.",
      ],
      [
        "Why it belongs in this portfolio",
        "This project connects interface development, content workflows and application infrastructure. It is a substantial example of my interest in building tools that support both an editor and a public audience.",
      ],
    ],
  },
  {
    slug: "rhythmz-wordpress",
    title: "Rhythmz WordPress",
    category: "Web Development",
    tags: ["WordPress", "JavaScript", "Blocks"],
    summary:
      "A pair of WordPress repositories exploring block-based development around The Events Calendar Pro.",
    repo: "rhythmz-theme",
    extraRepo: "rhythmz-plugin",
    sections: [
      [
        "The project",
        "The Rhythmz theme and plugin repositories describe WordPress block-based work built around The Events Calendar Pro. My 2025 resume separately records web development work for Rhythmz Lounge from September 2020 to June 2022.",
      ],
      [
        "The public source",
        "The repositories list event, icon, 3D, gallery, popup and venue-map blocks, along with dependency installation, build and development commands. The repository names and README headings are inconsistent, so both sources are linked here as a paired project.",
      ],
      [
        "The connection to my work",
        "Rhythmz sits at the intersection of content, events and visual presentation. It adds a WordPress example alongside the custom CMS and Angular work in this portfolio.",
      ],
    ],
  },
  {
    slug: "expense-tracking-system",
    title: "Athena’s Expense Tracking System",
    category: "Course Project",
    tags: ["TypeScript", "MEAN", "Collaboration"],
    summary:
      "A collaborative expense-tracking course project from WEB 450: Mastering the MEAN Stack Boot-camp.",
    repo: "ets",
    sections: [
      [
        "The project",
        "Athena’s Expense Tracking System is identified in its README as a WEB 450 course project for Mastering the MEAN Stack Boot-camp. The repository is primarily TypeScript.",
      ],
      [
        "Collaboration",
        "The README credits Sara Gorge, Exenreco Bell and Richard Krasso. This portfolio presents the project as collaborative academic work; it does not claim sole authorship or assign individual contributions that the source does not document.",
      ],
      [
        "Learning context",
        "The project belongs alongside my Angular, RESTful API, Node.js and NoSQL coursework. Together these repositories document a progression from individual technologies toward application development.",
      ],
    ],
  },
  {
    slug: "portfolio-evolution",
    title: "Portfolio Evolution",
    category: "Web Development",
    tags: ["Angular", "WordPress", "TypeScript"],
    summary:
      "A look at the public repositories behind successive approaches to my personal portfolio.",
    repo: "portfolio-2026",
    extraRepo: "alkamist",
    sections: [
      [
        "The project",
        "My public repositories include portfolio-2026, described as my 2026 portfolio site, and alkamist, described as my 2023 WordPress portfolio. The 2026 README documents an Angular CLI project.",
      ],
      [
        "Different foundations",
        "WordPress and Angular represent different approaches to presenting and maintaining personal work. These repositories provide source-level examples of those choices without implying that every version remains deployed.",
      ],
      [
        "An ongoing practice",
        "A portfolio is also a way to reflect on the work itself. This version connects projects to a fuller account of my education, technical background and creative interests.",
      ],
    ],
  },
  {
    slug: "sparksplus-wordpress-theme",
    title: "SparksPlus WordPress Theme",
    category: "Web Development",
    tags: ["WordPress", "PHP"],
    summary:
      "A public PHP repository described as a WordPress theme created for sparksplus.org.",
    repo: "sparksplus-theme",
    sections: [
      [
        "The project",
        "The public repository description identifies this as a WordPress theme created for sparksplus.org. GitHub identifies PHP as the primary language.",
      ],
      [
        "What the source supports",
        "The repository offers another example of WordPress theme work in my development portfolio. The available README does not provide a detailed feature list, so this overview stays limited to the verified description and links directly to the code.",
      ],
      [
        "Related practice",
        "Explore the Rhythmz WordPress repositories for a second example of my WordPress work, or visit the Web Development pillar for the wider context.",
      ],
    ],
  },
];
const page = (slug, title, summary, sections, schema = "WebPage") => ({
  slug,
  title,
  summary,
  sections,
  schema,
  kind: "page",
});
export const pages = [
  page(
    "home",
    "Web developer. Creative thinker. Hands-on builder.",
    "I’m Exenreco Bell, a web developer, graphic designer and technician based in Omaha, Nebraska.",
    [
      [
        "Work across the interface and the systems behind it",
        "My background brings together web development education, IT experience and mechanical and electrical engineering studies. I enjoy working through practical problems, learning new tools and turning ideas into useful digital experiences.",
      ],
      [
        "Three areas of practice",
        'Explore <a href="/web-development/">Web Development</a>, <a href="/technical-systems/">Technical Systems</a> and <a href="/creative-practice/">Creative Practice</a>. Each connects the work to the background behind it.',
      ],
      [
        "Selected work",
        '<a href="/projects/colossal-cms/">Colossal CMS</a>, <a href="/projects/rhythmz-wordpress/">Rhythmz WordPress</a> and <a href="/projects/expense-tracking-system/">Athena’s Expense Tracking System</a> offer different perspectives on my development work. <a href="/projects/">View all projects</a>.',
      ],
      [
        "Let’s talk",
        'For a project conversation, contact <a href="mailto:exenreco19@yahoo.com">exenreco19@yahoo.com</a>. You can also explore my <a href="https://github.com/exenreco">public GitHub repositories</a>.',
      ],
    ],
  ),
  page(
    "projects",
    "Projects",
    "Explore publishing tools, WordPress work, portfolio experiments and collaborative coursework.",
    [
      [
        "Code, context and the work behind it",
        "These posts introduce projects from my public GitHub repositories. Each links to its source and distinguishes independent work from collaborative coursework. New project posts can be added to this archive through the CMS.",
      ],
    ],
  ),
  page(
    "about",
    "About Exenreco Bell",
    "Web development, graphic design and technical problem solving come together in my work.",
    [
      [
        "A broad foundation",
        "I’m Exenreco Bell, a web developer, graphic designer and technician based in Omaha, Nebraska. My background combines web development education with information technology, mechanical engineering and electronics studies. I enjoy taking on new challenges and learning the tools needed to solve them.",
      ],
      [
        "How my interests connect",
        "Software, infrastructure and visual design are connected parts of the same experience. My public repositories cover content management, WordPress development, Angular applications and coursework. Outside the browser, I work on my home lab, 3D creation and printing, and photography.",
      ],
      [
        "The work behind the introduction",
        'Visit <a href="/projects/">Projects</a> for the source code and project context. The <a href="/background/">Background page</a> covers my education and the career history recorded in my 2025 resume.',
      ],
      [
        "Start a conversation",
        'Reach me at <a href="mailto:exenreco19@yahoo.com">exenreco19@yahoo.com</a> or explore <a href="https://github.com/exenreco">GitHub</a>.',
      ],
    ],
    "AboutPage",
  ),
  page(
    "background",
    "Background",
    "My education, career experience and the technical interests that inform my work.",
    [
      [
        "Web development education",
        "Bellevue University, United States: BS in Web Development, 2024–2025, with Web Development as the major and Computer Programming as the minor. Metropolitan Community College, Nebraska: AS in Web Development, 2014–2016, with Web Development as the major and Computer Programming as the minor. These dates and qualifications are recorded in my 2025 resume.",
      ],
      [
        "Earlier education in Jamaica",
        "Caribbean Advanced Proficiency Examination (CAPE), 2012–2013: Information Technology, Mechanical Engineering, Mathematics and English. Caribbean Examination Council (CXC), 2009–2011: studies included mechanical and electronics engineering, technical drawing, visual arts, information technology, mathematics and sciences. Heart Trust / NTCVET, 2010–2011: auto mechanic certificate.",
      ],
      [
        "Career history — as recorded in 2025",
        "Freelance Web Developer: December 2022 onward at the time of the resume. Fiserv, Technical Engineer: October 2023 onward at the time of the resume. Oriental Trading Company, Truck Loader: June–December 2022. Rhythmz Lounge, Web Developer: September 2020–June 2022. Care Builders at Home, Director of IT and Web Developer: February 2019–2022.",
      ],
      [
        "Development toolkit",
        'The resume lists WordPress, jQuery, JavaScript, React, Backbone, HTML, XML, CSS, C++ and PHP. My public repositories add examples of Angular and TypeScript work. Explore <a href="/web-development/">Web Development</a> to connect these tools to projects.',
      ],
      [
        "Beyond the resume",
        'My home lab uses Dell R6515 and R7515 servers, Proxmox, UniFi switches and a UDM Pro. I also create and print parts and tools, and take and manipulate photographs. Read more in <a href="/technical-systems/">Technical Systems</a> and <a href="/creative-practice/">Creative Practice</a>.',
      ],
    ],
  ),
  ...pillars.map((p) => ({
    ...p,
    kind: "page",
    schema: "WebPage",
    pillar: true,
  })),
];
export const entries = enrichSeo([
  ...pages,
  ...projects.map((p) => ({ ...p, kind: "post", schema: "Article" })),
]);
export const pathFor = (entry) =>
  entry.slug === "home"
    ? "/"
    : entry.kind === "post"
      ? `/projects/${entry.slug}/`
      : `/${entry.slug}/`;
