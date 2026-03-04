---
title: "DNS で Cloudflare Proxy を有効にした後にアクセスできなくなる問題の解決"
timestamp: 2025-12-15
description: "Caddy リバースプロキシと Cloudflare Proxy の競合問題を解決する。"
tags:
  - cloudflare
  - dns
  - else
draft: false
---

## 現象

Caddy をリバースプロキシサーバーとして使用し、その前に Cloudflare CDN を配置している場合、ウェブサイトにアクセスすると `ERR_TOO_MANY_REDIRECTS` エラーが発生するか、ブラウザが「ページが機能していません。リダイレクトの回数が多すぎます」と警告します。

## 原因分析

これは典型的な SSL/TLS 暗号化モードの不一致です：

1.  **Cloudflare 側**: デフォルトの SSL 設定が **"Flexible"** になっている可能性があります。このモードでは、Cloudflare はオリジンサーバー（Caddy）に **HTTP（ポート 80）** で接続しますが、訪問者には HTTPS を表示します。

2.  **Caddy 側**: Caddy はデフォルトで HTTPS を強制します。Cloudflare からの HTTP リクエストを受信すると、`301 Redirect` レスポンスを返し、HTTPS へのアップグレードを要求します。

3.  **無限ループ**: 301 を受け取った後、Cloudflare は再度リクエストを試みますが（Flexible モードのため依然として HTTP 経由）、Caddy は再度リダイレクトし、無限ループが発生します。

## 解決策

Cloudflare の SSL/TLS モードを **Flexible** から **Full** または **Full (Strict)** に変更してください。

- **Full**: Caddy が自己署名証明書を使用することを許可します（Caddy はデフォルトで内部暗号化用に自己署名証明書を自動生成します）。

- **Full (Strict)**: Caddy が有効な信頼できる証明書を持っている必要があります（Caddy が自動的に申請する Let's Encrypt 証明書は通常この要件を満たします）。
