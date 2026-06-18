#!/bin/bash
# EC2初期セットアップスクリプト
# 対応OS: Amazon Linux 2023 / Ubuntu 22.04・24.04
set -e

# OS検出
. /etc/os-release
OS=$ID
echo "=== EC2初期セットアップ開始 (OS: $OS) ==="

# ── Node.js 20 ─────────────────────────────
install_node() {
  if command -v node &>/dev/null && [[ $(node -v) == v20* ]]; then
    echo "Node.js 20 は導入済みです: $(node -v)"; return
  fi
  echo "Node.js 20 をインストールします..."
  if [ "$OS" = "amzn" ]; then
    sudo dnf install -y nodejs20 npm
  elif [ "$OS" = "ubuntu" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo "Node.js: $(node -v)"
}

# ── PostgreSQL ─────────────────────────────
install_postgres() {
  if command -v psql &>/dev/null; then
    echo "PostgreSQL は導入済みです"; return
  fi
  echo "PostgreSQL をインストールします..."
  if [ "$OS" = "amzn" ]; then
    sudo dnf install -y postgresql15 postgresql15-server
    sudo postgresql-setup --initdb
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
  elif [ "$OS" = "ubuntu" ]; then
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
  fi
  echo "PostgreSQL インストール完了"
}

# ── Nginx ──────────────────────────────────
install_nginx() {
  if command -v nginx &>/dev/null; then
    echo "Nginx は導入済みです"; return
  fi
  echo "Nginx をインストールします..."
  if [ "$OS" = "amzn" ]; then
    sudo dnf install -y nginx
  elif [ "$OS" = "ubuntu" ]; then
    sudo apt-get install -y nginx
  fi
  sudo systemctl enable nginx
  sudo systemctl start nginx
  echo "Nginx インストール完了"
}

# ── PM2 ───────────────────────────────────
install_pm2() {
  if command -v pm2 &>/dev/null; then
    echo "PM2 は導入済みです"; return
  fi
  sudo npm install -g pm2
  echo "PM2 インストール完了"
}

install_node
install_postgres
install_nginx
install_pm2

# ── アプリディレクトリ ──────────────────────
sudo mkdir -p /opt/advanced-issue
sudo chown "$(whoami)":"$(whoami)" /opt/advanced-issue
echo "アプリディレクトリ作成: /opt/advanced-issue"

# ── PostgreSQL: DBユーザー・DB作成 ──────────
echo ""
echo "=== PostgreSQL: DB初期化 ==="
read -p "DBユーザーのパスワードを入力してください: " DB_PASS

sudo -u postgres psql << SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inquiry_user') THEN
    CREATE USER inquiry_user WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE inquiry_db OWNER inquiry_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inquiry_db') \gexec

GRANT ALL PRIVILEGES ON DATABASE inquiry_db TO inquiry_user;
SQL
echo "DB初期化完了"

# ── .env ファイル作成 ─────────────────────
ENV_FILE="/opt/advanced-issue/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << ENV
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inquiry_db
DB_USER=inquiry_user
DB_PASSWORD=$DB_PASS
ENV
  echo ".env ファイルを作成しました: $ENV_FILE"
else
  echo ".env ファイルは既に存在します（スキップ）"
fi

# ── Nginx リバースプロキシ設定 ─────────────
NGINX_CONF="/etc/nginx/conf.d/advanced-issue.conf"
sudo tee "$NGINX_CONF" > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    # デフォルトサイトより先にこの設定が適用されるよう先頭に配置
    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Amazon Linux のデフォルトサイト無効化
[ -f /etc/nginx/nginx.conf ] && sudo sed -i 's|include /etc/nginx/conf.d/\*.conf;|include /etc/nginx/conf.d/*.conf;|' /etc/nginx/nginx.conf
# Ubuntu のデフォルトサイト無効化
[ -L /etc/nginx/sites-enabled/default ] && sudo rm /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
echo "Nginx設定完了"

# ── PM2 自動起動設定 ─────────────────────
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tail -1 | sudo bash
echo "PM2自動起動設定完了"

echo ""
echo "========================================"
echo "セットアップ完了！次のステップ:"
echo "  1. GitHub Actionsが自動デプロイします"
echo "     （初回のみ以下を手動実行）"
echo "  2. cd /opt/advanced-issue"
echo "  3. npm run migrate   # テーブル作成"
echo "  4. pm2 start ecosystem.config.js --env production"
echo "  5. pm2 save"
echo "========================================"
