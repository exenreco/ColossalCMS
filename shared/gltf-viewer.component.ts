import {
  Component,
  Input,
  ElementRef,
  AfterViewInit,
  inject,
} from "@angular/core";
import { hydrateModels } from "./gltf-host";
import { GltfBlockSkeletonComponent } from "./skeleton-compositions";

@Component({
  selector: "cl-gltf-viewer",
  standalone: true,
  imports: [GltfBlockSkeletonComponent],
  template: `<div
    class="gltf-viewer"
    [attr.data-model-url]="url"
    [attr.aria-label]="alt"
    data-controls="true"
    tabindex="0"
    style="height:360px"
  >
    <cl-gltf-block-skeleton />
  </div>`,
})
export class GltfViewerComponent implements AfterViewInit {
  @Input() url = "";
  @Input() alt = "";
  private host = inject(ElementRef);
  ngAfterViewInit() {
    hydrateModels(this.host.nativeElement);
  }
}
