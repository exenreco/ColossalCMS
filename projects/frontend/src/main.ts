import { initialPublicRender } from "../../../shared/public-render";
import { hydrateModels } from "../../../shared/gltf-host";
import { hydrateMenus } from "../../../shared/menu-host";
import { hydrateGeometry } from "../../../shared/geometry-host";
import { hydrateSliders } from "../../../shared/swiper-host";
import { hydrateAds } from "../../../shared/google-ads-host";

const rendered = initialPublicRender(document);
if (rendered?.frontendMode === "enhance" && !rendered.preview) {
  // Enhance the server's actual nodes. Rebuilding them restarts image loading/LCP.
  hydrateMenus(document);
  hydrateGeometry(document);
  hydrateSliders(document);
  hydrateModels(document);
  if (rendered.adsEnabled) hydrateAds(document);
  document.body.dataset["cmsEnhanced"] = "true";
} else {
  void import("./app").catch(console.error);
}
