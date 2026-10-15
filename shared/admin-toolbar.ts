import {
  DestroyRef,
  Directive,
  Injectable,
  TemplateRef,
  inject,
  signal,
} from "@angular/core";

/** Plugin-owned controls can join the admin toolbar without plugin logic in the shell. */
@Injectable({ providedIn: "root" })
export class AdminToolbar {
  content = signal<TemplateRef<unknown> | null>(null);
}

@Directive({ selector: "ng-template[clAdminToolbar]", standalone: true })
export class AdminToolbarDirective {
  constructor() {
    const toolbar = inject(AdminToolbar),
      template = inject(TemplateRef<unknown>);
    toolbar.content.set(template);
    inject(DestroyRef).onDestroy(() => {
      if (toolbar.content() === template) toolbar.content.set(null);
    });
  }
}
