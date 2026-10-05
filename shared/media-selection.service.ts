import { Injectable, signal } from "@angular/core";
import { MediaItem } from "./models";
export interface MediaSelectionOptions {
  accept?: ("image" | "audio" | "video" | "model")[];
  multiple?: boolean;
  initialSelectionIds?: string[];
}
@Injectable({ providedIn: "root" })
export class MediaSelectionService {
  options = signal<MediaSelectionOptions | null>(null);
  private resolve: ((items: MediaItem[]) => void) | null = null;
  open(options: MediaSelectionOptions = {}): Promise<MediaItem[]> {
    this.close([]);
    this.options.set(options);
    return new Promise((resolve) => (this.resolve = resolve));
  }
  close(items: MediaItem[] = []) {
    this.options.set(null);
    this.resolve?.(items);
    this.resolve = null;
  }
}
