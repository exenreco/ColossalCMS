import { Injectable, signal } from "@angular/core";
import {
  BlockPattern,
  PatternSource,
  RegisteredPattern,
  registerBlockPatterns,
} from "./block-patterns";
/** Runtime contributions from reviewed theme/plugin code; manifests also register declaratively. */
@Injectable({ providedIn: "root" })
export class PatternRegistry {
  contributions = signal<RegisteredPattern[]>([]);
  register(source: PatternSource, patterns: BlockPattern[]) {
    const added = registerBlockPatterns(source, patterns);
    if (
      added.some((pattern) =>
        this.contributions().some((existing) => existing.key === pattern.key),
      )
    )
      throw Error("This provider already registered that pattern.");
    this.contributions.update((current) => [...current, ...added]);
    return () =>
      this.contributions.update((current) =>
        current.filter(
          (pattern) => !added.some((entry) => entry.key === pattern.key),
        ),
      );
  }
}
