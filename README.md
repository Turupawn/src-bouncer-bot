# Run the bot

## Install dependencies

```bash
npm install
```

## Run locally

```bash
node bot.js
```

## Run on a server

```bash
sudo npm install -g pm2
pm2 start bot.js --name "bouncer-bot"
pm2 status
pm2 stop bouncer-bot
pm2 restart bouncer-bot
pm2 logs bouncer-bot
pm2 delete bouncer-bot
```

reverse proxy


`/etc/nginx/sites-available/default`
```
server {
    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/aworlds.world/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/aworlds.world/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    root /root/src-bouncer-bot/frontend/;
    index index.html index.htm index.nginx-debian.html;
    server_name aworlds.world;

    location / {
        try_files $uri $uri/ =404;
    }

    // add this
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

