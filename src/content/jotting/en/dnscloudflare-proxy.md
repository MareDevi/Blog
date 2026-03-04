---
title: "Fix Access Issues After Enabling Cloudflare Proxy for DNS"
timestamp: 2025-12-15
description: "Resolving conflict between Caddy reverse proxy and Cloudflare Proxy."
tags:
  - cloudflare
  - dns
  - else
draft: false
---

## Symptoms

When using Caddy as a reverse proxy server and enabling Cloudflare CDN in front of it, accessing the website results in `ERR_TOO_MANY_REDIRECTS` error, or the browser warns "The page isn't working, redirected you too many times."

## Analysis

This is a classic SSL/TLS encryption mode mismatch:

1.  **Cloudflare Side**: The default SSL setting might be **"Flexible"**. In this mode, Cloudflare connects to the origin server (Caddy) via **HTTP (Port 80)** but presents HTTPS to the visitor.

2.  **Caddy Side**: Caddy enforces HTTPS by default. When it receives an HTTP request from Cloudflare, it returns a `301 Redirect` response, requesting an upgrade to HTTPS.

3.  **Infinite Loop**: Upon receiving the 301, Cloudflare attempts the request again (still via HTTP, as it is in Flexible mode), causing Caddy to redirect again, creating an infinite loop.

## Solution

Change Cloudflare's SSL/TLS mode from **Flexible** to **Full** or **Full (Strict)**.

- **Full**: Allows Caddy to use a self-signed certificate (Caddy automatically generates self-signed certificates for internal encryption by default).

- **Full (Strict)**: Requires Caddy to have a valid trusted certificate (Caddy's automatically applied Let's Encrypt certificates usually satisfy this requirement).
