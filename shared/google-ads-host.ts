const publisherPattern = /^ca-pub-\d{16}$/;
let scriptReady: Promise<void> | undefined;

function loadAdSense(publisher: string): Promise<void> {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "colossal-google-ads-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      publisher;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("AdSense could not load.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
  return scriptReady;
}

/** Called only by the public frontend after the server enables live ads. */
export function hydrateAds(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>(".cl-google-ad[data-google-ad-client]")
    .forEach((host) => {
      if (host.dataset["adMounted"]) return;
      const publisher = host.dataset["googleAdClient"] || "";
      const slot = host.dataset["googleAdSlot"] || "";
      if (!publisherPattern.test(publisher) || !/^\d{1,20}$/.test(slot)) return;
      host.dataset["adMounted"] = "true";
      let visible = false;
      let requested = false;
      const resize = new ResizeObserver(() => start());
      const intersection = new IntersectionObserver(
        (entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          start();
        },
        { rootMargin: "150px" },
      );
      const start = () => {
        if (!host.isConnected) {
          resize.disconnect();
          intersection.disconnect();
          return;
        }
        if (requested || !visible || host.clientWidth === 0) return;
        const fixed = host.dataset["googleAdSizing"] === "fixed";
        const width = Math.max(
          50,
          Math.min(2000, Number(host.dataset["googleAdWidth"]) || 300),
        );
        const height = Math.max(
          50,
          Math.min(2000, Number(host.dataset["googleAdHeight"]) || 250),
        );
        // Wait until the selected fixed unit fits its parent instead of overflowing it.
        if (fixed && host.clientWidth < width) return;
        requested = true;
        resize.disconnect();
        intersection.disconnect();
        const ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.dataset["adClient"] = publisher;
        ins.dataset["adSlot"] = slot;
        if (fixed) {
          ins.style.width = width + "px";
          ins.style.height = height + "px";
        } else {
          const format = host.dataset["googleAdFormat"] || "auto";
          ins.dataset["adFormat"] = [
            "auto",
            "horizontal",
            "rectangle",
            "vertical",
          ].includes(format)
            ? format
            : "auto";
          ins.dataset["fullWidthResponsive"] = "true";
        }
        host.replaceChildren(ins);
        void loadAdSense(publisher)
          .then(() => {
            if (!ins.isConnected || ins.dataset["adsbygoogleStatus"]) return;
            const adWindow = window as unknown as {
              adsbygoogle: { push: (value: object) => void };
            };
            adWindow.adsbygoogle ||= [] as object[];
            try {
              adWindow.adsbygoogle.push({});
            } catch {
              host.dataset["adError"] = "true";
            }
          })
          .catch(() => {
            host.dataset["adError"] = "true";
          });
      };
      resize.observe(host);
      intersection.observe(host);
    });
}
