# Google Ads plugin

The optional bundled **Google Ads** plugin integrates Google AdSense display ad units. Install or activate it in Plugins, then open Google Ads in the system navigation.

Enter the publisher ID (`ca-pub-` followed by 16 digits; `pub-` is also accepted), numeric default ad slot, format, and sizing. These are public ad identifiers, not API keys. Saving does not connect a Google account or create a Google Ads campaign. Google controls account/site approval and ad availability.

Add **Ads** from the Plugin group in the Theme Editor, post editor, or page editor. The block inherits the plugin defaults, supports a slot override, and can select responsive or fixed sizing. For fixed sizing, specify a width and height that fit the block's parent.

Live ads are disabled by default. With **Enable live ads on public pages** off, configured blocks display preview placeholders. Editor canvases and signed theme previews always display placeholders and never load the AdSense script. Deactivating the plugin removes live ad rendering and hides Ads from the block library while preserving existing block data and settings.

The public frontend loads Google's asynchronous script once when a valid, visible ad unit has space to render. It initializes each unit once. Script URLs are generated from validated publisher IDs; users cannot enter arbitrary scripts. Settings are stored in a separate configuration record through the administrator-only `/api/admin/google-ads` endpoint.

Reference: [Google's responsive AdSense ad code](https://support.google.com/adsense/answer/9183363).

## Site verification and ads.txt

With the plugin active and a valid publisher ID saved, public HTML includes `<meta name="google-adsense-account" content="ca-pub-…">` in the document head. `/ads.txt` returns `google.com, pub-…, DIRECT, f08c47fec0942fa0` as plain text. These work without JavaScript, an Ads block, an ad slot, or enabling live ads. Vercel routes the homepage, `/index.html`, and `/ads.txt` through the CMS so static assets do not bypass saved configuration. Admin pages do not receive the verification tag. Deactivation or an invalid/missing publisher ID removes the tag and makes `/ads.txt` return 404.

In **AdSense → Sites**, add your domain, select **Meta tag** or **Ads.txt snippet** as the verification method, verify ownership, and request review. The root domain must serve or redirect to the same ads.txt file. Website availability alone does not establish account ownership or approval. See [Google's site verification instructions](https://support.google.com/adsense/answer/7584263) and [ads.txt crawler requirements](https://support.google.com/adsense/answer/7679060).

`ERR_BLOCKED_BY_CLIENT` usually means a browser extension or privacy feature blocked an ad request. Test with site-specific ad blocking disabled or a clean browser profile. Extension message-channel errors require checking the console source/stack; they do not establish a server or database failure. The CMS catches AdSense script-load failures and marks the affected block with `data-ad-error="true"`. It cannot bypass browser blocking or grant Google approval. Google Ad Manager, Google Ads campaign management, and Google AdSense are separate products; this plugin integrates AdSense display units only.
