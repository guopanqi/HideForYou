# HideForYou

A lightweight userscript for a cleaner X (formerly Twitter) experience on mobile and desktop browsers.

HideForYou prioritizes the **Following** timeline and helps remove distractions, including **For You**, suggested accounts, trending topics, news cards, sports scorecards, and other sidebar recommendations. The desktop right sidebar has separate controls for search and recommendations. Search is visible by default.

## Install

Open [hide-for-you.user.js](https://raw.githubusercontent.com/guopanqi/HideForYou/main/hide-for-you.user.js) in a browser with a userscript manager, then choose **Detect / Install** or your manager's equivalent.

- **iPhone / iPad:** Safari with the Userscripts extension.
- **Desktop:** A compatible userscript manager such as Tampermonkey or Violentmonkey.

## Settings

Open **HideForYou settings** below **Settings and privacy** in X's navigation. Mobile and desktop layouts differ, so the menu entry may require updates when X changes its interface. A fallback settings URL is [x.com/home#xclean-settings](https://x.com/home#xclean-settings).

Settings are stored locally in the browser. No account credentials are collected or transmitted by this script.

## Updates

The userscript declares `@updateURL` and `@downloadURL` pointing to this repository. Update-check behavior depends on your userscript manager.

## Compatibility (beta)

Designed for X's mobile and desktop web interfaces. This is a beta release. The settings entry and filtering behavior still need verification on live mobile and desktop layouts. X changes its DOM frequently, so some filters may occasionally stop working. This is an independent community script and is not affiliated with X.

## Source

- [Userscript](./hide-for-you.user.js)
- [Update metadata](./hide-for-you.meta.js)

## License

[MIT](./LICENSE)
