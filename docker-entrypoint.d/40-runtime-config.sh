#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.BIDLY_CONFIG = {
  S3_PUBLIC_BASE_URL: "${S3_PUBLIC_BASE_URL:-}"
}
EOF
