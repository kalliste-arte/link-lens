# Link Lens

A small Chrome/Edge Manifest V3 extension that highlights potentially suspicious links using local heuristics.

## Features

- Low, medium, and high risk cursor colors with detailed warning reasons
- Optional confirmation before high-risk navigation and potentially risky downloads
- Page summary in the extension popup
- Domain allowlist and one-time ignore controls
- Privacy mode, enabled by default, keeps analysis local
- Optional manual Google Safe Browsing lookup when privacy mode is disabled

## Install locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `link-lens` folder.
4. Open or refresh a webpage, then hover over links.

The extension does not send URLs anywhere by default and does not prove that a link is malicious. It only flags signals worth checking before clicking. Loading a URL into the optional reputation lookup sends that URL to Google after you explicitly press the button.