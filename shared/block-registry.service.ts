import { Injectable, signal } from "@angular/core";
import definitions from "./theme-blocks.json";
import { BlockDefinition, BlockNode } from "./theme-models";
/** Declarative blocks from reviewed bundled plugins; templates are sanitized by the server on save. */
@Injectable({ providedIn: "root" })
export class BlockRegistry {
  definitions = signal<BlockDefinition[]>(definitions as BlockDefinition[]);
  register(block: BlockDefinition) {
    if (this.definitions().some((b) => b.type === block.type))
      throw new Error("Duplicate block type: " + block.type);
    if (block.icon && this.definitions().some((b) => b.icon === block.icon)) {
      console.warn(
        `Block icon collision for ${block.type}; using the generic block icon.`,
      );
      block = { ...block, icon: "fas fa-block" };
    }
    this.definitions.update((b) => [...b, block]);
  }
  removePlugin(id: string) {
    this.definitions.update((b) => b.filter((x) => x.pluginId !== id));
  }
  create(type: string): BlockNode {
    const def = this.definitions().find((b) => b.type === type);
    return {
      id: "blk_" + crypto.randomUUID(),
      type,
      settings: Object.fromEntries(
        (def?.fields || []).map((f) => [
          f.key,
          structuredClone(f.default ?? ""),
        ]),
      ),
      ...(def?.container ? { children: [] } : {}),
    };
  }
}
