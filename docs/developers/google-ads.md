# Google Ads plugin

The optional bundled **Google Ads** plugin integrates Google AdSense display ad units. Install or activate it in Plugins, then open Google Ads in the system navigation.

Enter the publisher ID (`ca-pub-` followed by 16 digits; `pub-` is also accepted), numeric default ad slot, format, and sizing. These are public ad identifiers, not API keys. Saving does not connect a Google account or create a Google Ads campaign. Google controls account/site approval and ad availability.

Add **Ads** from the Plugin group in the Theme Editor, post editor, or page editor. The block inherits the plugin defaults, supports a slot override, and can select responsive or fixed sizing. For fixed sizing, specify a width and height that fit the block's parent.

Live ads are disabled by default. With **Enable live ads on public pages** off, configured blocks display preview placeholders. Editor canvases and signed theme previews always display placeholders and never load the AdSense script. Deactivating the plugin removes live ad rendering and hides Ads from the block library while preserving existing block data and settings.

The public frontend loads Google's asynchronous script once when a valid, visible ad unit has space to render. It initializes each unit once. Script URLs are generated from validated publisher IDs; users cannot enter arbitrary scripts. Settings are stored in a separate configuration record through the administrator-only `/api/admin/google-ads` endpoint.

Reference: [Google's responsive AdSense ad code](https://support.google.com/adsense/answer/9183363).
