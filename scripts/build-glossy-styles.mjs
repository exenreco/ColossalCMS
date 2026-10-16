import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";

/** Keep shared frontend controls, without font downloads unused by Glossy's Arial design. */
export async function buildGlossyStyles(root) {
  const indexPath = join(root, "index.html");
  let html = await readFile(indexPath, "utf8");
  const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
  for (const [tag] of links) {
    const href = tag.match(/\bhref="([^"/][^"]*\.css)"/)?.[1];
    if (!href || href.includes("..")) continue;
    const tree = postcss.parse(await readFile(join(root, href), "utf8"));
    tree.walkAtRules("font-face", (rule) => {
      if (
        rule.nodes?.some(
          (node) =>
            node.prop === "font-family" && /DM Sans|Manrope/i.test(node.value),
        )
      )
        rule.remove();
    });
    tree.walkAtRules("import", (rule) => {
      if (rule.params.includes("fonts.googleapis.com")) rule.remove();
    });
    const css = tree.toString();
    const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
    const file = `glossy-system-${hash}.css`;
    await writeFile(join(root, file), css);
    html = html.replaceAll(
      tag,
      tag.replace(/>$/, ` data-glossy-href="${file}">`),
    );
  }
  await writeFile(indexPath, html);
}
