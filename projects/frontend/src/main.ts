import { RichContentComponent } from "../../../shared/rich-content.component";
import {
  PostsListSkeletonComponent,
  PostSingleSkeletonComponent,
} from "../../../shared/skeleton-compositions";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { inject, afterEveryRender } from "@angular/core";
import { hydrateModels } from "../../../shared/gltf-host";
import { hydrateSliders } from "../../../shared/swiper-host";
import { hydrateAds } from "../../../shared/google-ads-host";
import { bootstrapApplication } from "@angular/platform-browser";
import { Component, OnInit, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { IconComponent } from "../../../shared/icon.component";
import { Content, Settings, Plugin, MediaItem } from "../../../shared/models";
function initialMaintenanceRender() {
  try {
    const payload = document.getElementById("maintenance-render")?.textContent;
    const rendered = payload ? JSON.parse(payload) : null;
    return rendered?.maintenance === true && typeof rendered.html === "string"
      ? rendered
      : null;
  } catch {
    return null;
  }
}
@Component({
  selector: "cl-frontend",
  standalone: true,
  imports: [
    IconComponent,
    DatePipe,
    RichContentComponent,
    PostsListSkeletonComponent,
    PostSingleSkeletonComponent,
  ],
  template: `
    @if (themeMarkup()) {
      @if (isPreview) {
        <div class="theme-preview-banner">
          {{
            maintenancePreview
              ? "Maintenance preview · Administrator only."
              : "Theme preview · This link expires after 15 minutes."
          }}
          <a href="/">Exit preview</a>
        </div>
      }
      @if (data(); as site) {
        @if (active("announcement") && site.settings.announcement) {
          <div class="announcement">{{ site.settings.announcement }}</div>
        }
      }
      <div [innerHTML]="themeMarkup()"></div>
    } @else if (data(); as site) {
      <div class="public-site" [style.--site-accent]="site.settings.accent">
        @if (active("announcement") && site.settings.announcement) {
          <div class="announcement">{{ site.settings.announcement }}</div>
        }
        <header class="public-header">
          <a class="public-brand" href="/">
            @if (site.settings.logo) {
              <img [src]="site.settings.logo" [alt]="site.settings.title" />
            } @else {
              <span class="public-mark">C</span>{{ site.settings.title }}
            }
          </a>
          <nav aria-label="Site navigation">
            @if (
              site.settings.homePageId ||
              (site.settings.routingVersion !== 2 &&
                site.settings.postRouting === "page")
            ) {
              <a href="/" [class.current]="home">Home</a>
            }
            @if (hasPostIndex) {
              <a [href]="journalPath" [class.current]="postIndex">{{
                postsPage?.title || "Journal"
              }}</a>
            }
            @for (p of pages; track p.id) {
              <a [href]="'/' + p.slug" [class.current]="entry?.id === p.id">{{
                p.title
              }}</a>
            }
          </nav>
          <a class="public-admin" href="/admin/" aria-label="Open CMS workspace"
            ><cl-icon name="dashboard"
          /></a>
        </header>
        <main class="public-main">
          @if (postIndex) {
            <section class="journal-heading">
              <p class="eyebrow">THE JOURNAL</p>
              <h1>{{ postsPage?.title || site.settings.tagline }}</h1>
              <div class="journal-heading-bottom">
                <span>Stories, perspectives & a little curiosity.</span
                ><span
                  >{{ posts.length }}
                  {{ posts.length === 1 ? "story" : "stories" }} and
                  counting</span
                >
              </div>
            </section>
            <div class="journal-grid">
              @for (p of posts; track p.id; let i = $index) {
                <a
                  class="journal-card"
                  [class.featured]="i === 0"
                  [href]="path(p)"
                  ><div class="journal-card-meta">
                    <span>NOTES & IDEAS</span
                    ><span>{{ p.publishAt | date: "MMM d, y" }}</span>
                  </div>
                  @if (featured(p); as image) {
                    <img
                      class="journal-featured-image"
                      [src]="image.url + '?v=' + image.updatedAt"
                      [alt]="image.altText"
                    />
                  }
                  <h2>{{ p.title }}</h2>
                  <p>{{ p.excerpt }}</p>
                  <div class="journal-card-footer">
                    <span>{{
                      active("reading-time")
                        ? readingTime(p) + " min read"
                        : "Read the story"
                    }}</span
                    ><cl-icon name="arrow" /></div
                ></a>
              } @empty {
                <div class="public-empty">
                  <h2>A new chapter is on its way.</h2>
                  <p>Come back soon for our first story.</p>
                </div>
              }
            </div>
          } @else if (entry) {
            <article class="public-article">
              <a class="back-link" [href]="journalPath"
                >← Back to {{ postsPage?.title || "journal" }}</a
              >
              <p class="eyebrow">
                {{
                  entry.kind === "post"
                    ? "FROM THE JOURNAL"
                    : "A LITTLE ABOUT US"
                }}
              </p>
              <h1>{{ entry.title }}</h1>
              @if (entry.excerpt) {
                <p class="article-excerpt">{{ entry.excerpt }}</p>
              }
              @if (entry.kind === "post") {
                <div class="article-meta">
                  <span>{{ entry.publishAt | date: "MMMM d, y" }}</span>
                  @if (active("reading-time")) {
                    <span>{{ readingTime(entry) }} min read</span>
                  }
                </div>
              }
              @if (featured(entry); as image) {
                <figure class="article-featured-image">
                  <img
                    [src]="image.url + '?v=' + image.updatedAt"
                    [alt]="image.altText"
                  />
                  @if (image.caption) {
                    <figcaption>{{ image.caption }}</figcaption>
                  }
                </figure>
              }
              <div class="article-body">
                @if (entry.details?.richText) {
                  <cl-rich-content
                    [nodes]="entry.details!.richText!.content || []"
                    [media]="site.media"
                  />
                } @else {
                  @for (paragraph of paragraphs; track $index) {
                    <p>{{ paragraph }}</p>
                  }
                }
              </div>
            </article>
          } @else if (home && site.settings.homePageId) {
            <section class="journal-heading">
              <p class="eyebrow">{{ site.settings.title }}</p>
              <h1>{{ site.settings.tagline }}</h1>
              <p class="home-journal-link">
                <a class="button primary" [href]="journalPath"
                  >Explore {{ postsPage?.title || "the journal" }}
                  <cl-icon name="arrow"
                /></a>
              </p>
            </section>
          } @else {
            <div class="public-empty">
              <p class="eyebrow">404</p>
              <h1>This page hasn’t found its words yet.</h1>
              <p>The page may have moved or isn’t published.</p>
              <a class="button primary" href="/">Back to journal</a>
            </div>
          }
        </main>
        <footer class="public-footer">
          <a href="/">{{ site.settings.title }}</a
          ><span>A little curiosity goes a long way.</span
          ><span>Powered by Colossal</span>
        </footer>
      </div>
    } @else if (!error()) {
      <div
        class="public-skeleton"
        role="status"
        aria-busy="true"
        aria-label="Opening the journal"
      >
        @if (postIndex) {
          <cl-posts-list-skeleton layout="grid" />
        } @else {
          <cl-post-single-skeleton />
        }
      </div>
    } @else {
      <div class="auth-page">
        <div class="auth-card">
          <h1>We’ll be right back.</h1>
          <p>{{ error() }}</p>
          <button class="button" (click)="load()">Try again</button>
        </div>
      </div>
    }
  `,
})
class FrontendComponent implements OnInit {
  constructor() {
    afterEveryRender(() => {
      hydrateModels(document);
      hydrateSliders(document);
      if (this.adsEnabled && !this.isPreview) hydrateAds(document);
    });
  }
  data = signal<{
    settings: Settings;
    content: Content[];
    plugins: Plugin[];
    media: MediaItem[];
  } | null>(null);
  sanitizer = inject(DomSanitizer);
  private initialRender = initialMaintenanceRender();
  themeMarkup = signal<SafeHtml>(
    this.initialRender
      ? this.sanitizer.bypassSecurityTrustHtml(this.initialRender.html)
      : "",
  );
  isPreview = this.initialRender?.preview === true;
  adsEnabled = false;
  maintenancePreview = this.initialRender?.maintenancePreview === true;
  error = signal("");
  home = location.pathname === "/";
  entry: Content | undefined;
  ngOnInit() {
    this.load();
  }
  async load() {
    this.error.set("");
    try {
      const params = new URLSearchParams(location.search);
      params.set("path", location.pathname);
      const maintenancePreviewId = document.querySelector<HTMLMetaElement>(
        'meta[name="colossal-maintenance-preview"]',
      )?.content;
      const theme = await fetch(
        maintenancePreviewId
          ? "/api/maintenance/" +
              encodeURIComponent(maintenancePreviewId) +
              "/preview-render?templateId=" +
              encodeURIComponent(params.get("templateId") || "")
          : "/api/themes/render?" + params,
      );
      if (theme.ok) {
        const rendered = await theme.json();
        // Only the server's sanitized theme renderer can cross this HTML boundary.
        this.themeMarkup.set(
          this.sanitizer.bypassSecurityTrustHtml(rendered.html),
        );
        document.body.className = ["theme-root", rendered.body?.className]
          .filter(Boolean)
          .join(" ");
        document.body.style.cssText = rendered.body?.style || "";
        document.body.dataset["blockId"] = rendered.body?.blockId || "";
        document.body.dataset["themeId"] = rendered.body?.themeId || "";
        document.body.dataset["themeTemplate"] =
          rendered.body?.templateId || "";
        this.isPreview = rendered.preview;
        this.maintenancePreview = rendered.maintenancePreview === true;
        this.adsEnabled = rendered.adsEnabled === true;
        let styles = document.getElementById("theme-styles");
        if (!styles) {
          styles = document.createElement("style");
          styles.id = "theme-styles";
          document.head.appendChild(styles);
        }
        styles.textContent = rendered.css;
        if (rendered.title) document.title = rendered.title;
        document
          .querySelector('meta[name="description"]')
          ?.setAttribute("content", rendered.description || "");
        if (rendered.maintenance) return;
      } else if (params.has("themePreview")) {
        const result = await theme.json();
        throw new Error(result.error || "Preview is no longer available.");
      }
      const r = await fetch("/api/public");
      if (!r.ok)
        throw new Error(
          "Content is temporarily unavailable. Please try again.",
        );
      const site = await r.json();
      this.data.set(site);
      this.entry =
        this.home && site.settings.homePageId
          ? site.content.find(
              (c: Content) =>
                c.id === site.settings.homePageId ||
                (!site.settings.homePageId &&
                  c.kind === "page" &&
                  c.slug === "home"),
            )
          : site.content.find(
              (c: Content) => this.path(c) === location.pathname,
            );
      if (!this.entry && !this.postIndex && site.settings.notFoundPageId)
        this.entry = site.content.find(
          (c: Content) => c.id === site.settings.notFoundPageId,
        );
      const favicon =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon)
        favicon.href = site.settings.siteIconId
          ? "/api/media/" + site.settings.siteIconId + "/file"
          : "/favicon.svg";
      document.title =
        (this.entry
          ? (this.entry.details?.metaTitle || this.entry.title) + " · "
          : "") + site.settings.title;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute(
          "content",
          this.entry?.details?.metaDescription ||
            this.entry?.excerpt ||
            site.settings.tagline,
        );
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  get postsPage() {
    return this.data()?.settings.postsPageId &&
      (this.data()?.settings.routingVersion === 2 ||
        this.data()?.settings.postRouting === "page")
      ? this.data()!.content.find(
          (c) => c.id === this.data()!.settings.postsPageId,
        )
      : undefined;
  }
  get hasPostIndex() {
    return this.data()?.settings.routingVersion === 2
      ? !this.data()?.settings.homePageId || !!this.postsPage
      : true;
  }
  get journalPath() {
    return this.postsPage ? "/" + this.postsPage.slug : "/";
  }
  get postIndex() {
    return this.hasPostIndex && location.pathname === this.journalPath;
  }
  featured(c: Content) {
    return this.data()?.media.find((m) => m.id === c.details?.featuredImageId);
  }
  get pages() {
    return this.data()!.content.filter(
      (c) =>
        c.kind === "page" &&
        c.id !== this.postsPage?.id &&
        c.id !== this.data()!.settings.homePageId,
    );
  }
  get posts() {
    return this.data()!
      .content.filter((c) => c.kind === "post")
      .sort((a, b) => b.publishAt.localeCompare(a.publishAt));
  }
  get paragraphs() {
    return this.entry?.body.split(/\n\s*\n/).filter(Boolean) || [];
  }
  active(id: string) {
    return this.data()!.plugins.some((p) => p.id === "com.colossal." + id);
  }
  readingTime(c: Content) {
    return Math.max(
      1,
      Math.ceil(c.body.trim().split(/\s+/).filter(Boolean).length / 200),
    );
  }
  path(c: Content) {
    const d = new Date(c.publishAt);
    const component = c.kind === "page" ? "PageComponent" : "PostComponent";
    const route = this.data()
      ?.plugins.flatMap((p) => p.frontend.routes)
      .find((r) => r.component === component);
    if (!route) return "/";
    return (
      "/" +
      route.path
        .replace(":year", String(d.getUTCFullYear()))
        .replace(":month", String(d.getUTCMonth() + 1).padStart(2, "0"))
        .replace(":slug", c.slug)
    );
  }
}
bootstrapApplication(FrontendComponent).catch(console.error);
