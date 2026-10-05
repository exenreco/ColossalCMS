import { Component, Input } from "@angular/core";
import { RichNode, MediaItem } from "./models";
@Component({
  selector: "cl-rich-content",
  standalone: true,
  template: ` @for (node of nodes; track $index) {
    @switch (node.type) {
      @case ("text") {
        <span [innerHTML]="formatted(node)"></span>
      }
      @case ("paragraph") {
        <p><cl-rich-content [nodes]="node.content || []" [media]="media" /></p>
      }
      @case ("heading") {
        @if (node.attrs?.["level"] === 2) {
          <h2>
            <cl-rich-content [nodes]="node.content || []" [media]="media" />
          </h2>
        } @else {
          <h3>
            <cl-rich-content [nodes]="node.content || []" [media]="media" />
          </h3>
        }
      }
      @case ("bulletList") {
        <ul>
          <cl-rich-content [nodes]="node.content || []" [media]="media" />
        </ul>
      }
      @case ("orderedList") {
        <ol [attr.start]="node.attrs?.['start'] || 1">
          <cl-rich-content [nodes]="node.content || []" [media]="media" />
        </ol>
      }
      @case ("listItem") {
        <li>
          <cl-rich-content [nodes]="node.content || []" [media]="media" />
        </li>
      }
      @case ("blockquote") {
        <blockquote>
          <cl-rich-content [nodes]="node.content || []" [media]="media" />
        </blockquote>
      }
      @case ("codeBlock") {
        <pre><code>{{plain(node)}}</code></pre>
      }
      @case ("hardBreak") {
        <br />
      }
      @case ("horizontalRule") {
        <hr />
      }
      @case ("media") {
        @if (item(node); as m) {
          <figure>
            @if (m.type === "image") {
              <img
                [src]="m.url + '?v=' + m.updatedAt"
                [alt]="m.altText"
                loading="lazy"
              />
            } @else if (m.type === "audio") {
              <audio [src]="m.url" controls preload="metadata"></audio>
            } @else {
              <video [src]="m.url" controls preload="metadata"></video>
            }
            @if (m.caption) {
              <figcaption>{{ m.caption }}</figcaption>
            }
          </figure>
        }
      }
      @default {
        <cl-rich-content [nodes]="node.content || []" [media]="media" />
      }
    }
  }`,
})
export class RichContentComponent {
  @Input() nodes: RichNode[] = [];
  @Input() media: MediaItem[] = [];
  item(node: RichNode) {
    return this.media.find((m) => m.id === node.attrs?.["mediaId"]);
  }
  plain(node: RichNode): string {
    return node.text || node.content?.map((n) => this.plain(n)).join("") || "";
  }
  escape(text: string) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  formatted(node: RichNode) {
    let text = this.escape(node.text || "");
    for (const mark of node.marks || []) {
      const tags: Record<string, string> = {
        bold: "strong",
        italic: "em",
        underline: "u",
        strike: "s",
        code: "code",
      };
      if (tags[mark.type])
        text =
          "<" + tags[mark.type] + ">" + text + "</" + tags[mark.type] + ">";
      else if (
        mark.type === "link" &&
        /^(https?:\/\/|mailto:|\/(?!\/))/.test(mark.attrs?.["href"] || "")
      )
        text =
          '<a href="' +
          this.escape(mark.attrs!["href"]) +
          '" target="_blank" rel="noopener noreferrer">' +
          text +
          "</a>";
    }
    return text;
  }
}
