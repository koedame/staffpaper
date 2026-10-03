# Security Policy

## Reporting a vulnerability

Please report security problems privately through
[GitHub's private vulnerability reporting](https://github.com/koedame/staffpaper/security/advisories/new).
Do not open a public issue for them.

## Supported versions

Security fixes are applied to the version published at https://staffpaper.koeda.me only.

## What counts as a vulnerability

staffpaper builds the PDF in your browser. It takes no text input, and your choices and
the generated PDF are never sent anywhere. The host that serves the page may inject its own script into the
HTML; the page's Content-Security-Policy blocks it. We treat these as vulnerabilities:

- The page loading or running script from anywhere other than its own files.
- The page sending data about you or your choices to another site.
- A crafted link or query string that changes what the page runs or downloads.
