# 救急物品 在庫管理アプリ

職場で使用する救急物品の在庫を管理するためのWebアプリです。

## 主な機能

- 物品マスタ登録
- 在庫一覧、物品名検索、保管場所絞り込み
- 状態フィルターによる不足一覧表示
- 受入・払出の記録
- 受払履歴の一覧表示
- 要望チェックと物品要望書CSV出力
- CSVインポート、CSVエクスポート
- サーバー版で複数端末から同じデータを共有
- サーバー版では数秒ごとに最新の在庫数と履歴を自動同期
- Render公開版ではPostgreSQLデータベースへ保存

## ローカルで使う

`index.html` をダブルクリックすると、ブラウザだけで使えます。

この場合、データはその端末のブラウザ内に保存されます。

## サーバー版として使う

Node.jsをインストールしたパソコンで、次のどちらかを実行します。

Windowsの場合:

```bat
start-server.bat
```

または:

```bash
npm start
```

起動後、親機では次のURLを開きます。

```text
http://localhost:8080
```

同じネットワーク内の別端末からは、起動画面に表示されるURLを開きます。

```text
http://親機のIPアドレス:8080
```

PCとスマホでデータを共有する場合は、両方の端末でサーバーのURLを開いてください。

`index.html` を直接開いた画面やGitHub Pagesの画面では、データは各端末内に保存されるため共有されません。

## GitHubに置く

初回だけ次の手順でGitHubへアップロードします。

```bash
git init
git add .
git commit -m "Initial emergency inventory app"
git branch -M main
git remote add origin https://github.com/ユーザー名/リポジトリ名.git
git push -u origin main
```

## Renderなどで公開する

GitHubにアップロードしたあと、Renderで `New Blueprint` を選び、このリポジトリを接続します。

`render.yaml` により、WebアプリとPostgreSQLデータベースが作成されます。

Renderの公開URLはHTTPSで通信されます。在庫数と履歴はPostgreSQLデータベースに保存されるため、親機PCを起動しておく必要はありません。

## セキュリティ注意

Render公開版にはログイン機能がありません。URLを知っている人は閲覧・更新できます。

患者情報や個人情報は入力しないでください。アクセス制限が必要になった場合は、職員ごとのログイン機能を追加してください。
