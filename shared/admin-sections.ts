import { DestroyRef, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

/** Connect in-page plugin sections to deep links and browser back/forward navigation. */
export function adminSections(
  sections: Record<string, string>,
  fallback: string,
  onChange?: () => void,
) {
  const route = inject(ActivatedRoute),
    router = inject(Router);
  const value = signal(fallback);
  const subscription = route.queryParamMap.subscribe((params) => {
    const key = params.get("tab") || "";
    value.set(Object.hasOwn(sections, key) ? sections[key] : fallback);
    onChange?.();
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return {
    value,
    select(label: string) {
      const tab = Object.keys(sections).find((key) => sections[key] === label);
      if (tab)
        void router.navigate([], {
          relativeTo: route,
          queryParams: { tab },
          queryParamsHandling: "merge",
        });
    },
  };
}
