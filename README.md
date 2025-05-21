# go jp rss

[各府省の新着情報](https://www.gov-online.go.jp/info/index.html) を RSS にするツール

## 概要

このプロジェクトは、[各府省の新着情報](https://www.gov-online.go.jp/info/index.html) ウェブページから情報を取得し、RSS フィードに変換するツールです。GitHub Actions を使用して毎日自動的に実行され、最新の情報を RSS フィードとして提供します。

[www.gov-online.go.jp-info.rss](https://t-ashula.github.io/go-jp-rss/www.gov-online.go.jp-info.rss)

## 機能

- 各府省の新着情報ウェブページから情報を取得
- HTML を解析して RSS フィードに変換
- 前回処理した URL 以降の新しい情報のみを取得
- 最大 40 件の情報を RSS フィードに含める
- 1 週間以上前の情報は除外

## セットアップ

### 必要条件

- Node.js 24
- npm

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/t-ashula/go-jp-rss.git
cd go-jp-rss

# 依存関係をインストール
npm install
```

### 実行方法

```bash
npm start
```

実行すると、`feed/www.gov-online.go.jp-info.rss` に RSS ファイルが生成されます。

## GitHub 連携

- GitHub Actions により日本時間 13:30 に毎日自動実行
- GitHub Pages で RSS フィードを公開 (`https://<username>.github.io/go-jp-rss/www.gov-online.go.jp-info.rss`)

## 技術スタック

- TypeScript
- Node.js
- jsdom (HTML 解析)
- pino (ロギング)
- GitHub Actions (自動実行)
- GitHub Pages (配信)
