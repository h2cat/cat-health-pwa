# 猫の健康管理アプリ

個人利用向けの猫の食事・健康管理PWA。ブラウザ内（IndexedDB）にデータを保存し、
サーバーは使わない。JSONでのバックアップ（エクスポート/インポート）に対応。

## GitHub Pagesで公開する手順

1. GitHubで新規リポジトリを作成する（例: `cat-health-pwa`）。Public/Privateどちらでも可
   （Privateの場合もGitHub Pagesは公開URLになる点に注意。個人利用なら気にしなくてOK）。
2. このフォルダの中身（index.html, manifest.json, service-worker.js, css/, js/, icons/）を
   リポジトリ直下にコミット＆プッシュする。

   ```
   cd cat-health-pwa
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<your-account>/cat-health-pwa.git
   git push -u origin main
   ```

3. GitHubのリポジトリ画面 → Settings → Pages を開く。
4. "Build and deployment" の Source を "Deploy from a branch" にし、
   Branch を `main` / `/ (root)` にして Save。
5. 数十秒〜数分待つと `https://<your-account>.github.io/cat-health-pwa/` で公開される。

## iPhoneでホーム画面に追加する

1. SafariでPagesのURLを開く。
2. 共有ボタン →「ホーム画面に追加」。
3. ホーム画面のアイコンから起動するとPWA（ネイティブアプリ風）として動作する。

## データについて

- すべてブラウザ内（IndexedDB）に保存される。Safariの「履歴とWebサイトデータを消去」
  やアプリの再インストールでデータが消える可能性があるため、定期的に
  「設定タブ → データ入出力 → エクスポート」でJSONバックアップを取ることを推奨する。
- 機種変更時は、エクスポートしたJSONを新しい端末で「インポート」すればデータを引き継げる。

## 今回のスコープ外（将来対応）

- ダッシュボードでの体重推移グラフなどの可視化
- 複数端末間のリアルタイム同期（サーバーを使わない構成のため非対応）
