# Remote deployment performance

Civil Command batches browser KV reads through `POST /api/data/batch`, compresses eligible responses, and revalidates static files with ETags. No `civil-memory` upgrade or storage migration is required. HTTP/2 between the browser and the server is enabled at the TLS reverse proxy, not by `start`.

## Upgrade and configure Nginx

1. After merging, update the server's `civil-command` checkout (commonly `civil-command` under `/opt`) with `git pull --ff-only origin main` and run `./scripts/service--restart` from the checkout. Keep the existing backend URL and directory mode. Civil Command should be loopback-bound when behind Nginx, and `CC_ALLOWED_HOSTS` must include the public hostname. Preserve the existing authentication, upstream and `Host` forwarding.
2. Back up the enabled site config (under `/etc/nginx/sites-enabled`) outside the enabled-sites directory. Example: `sudo cp -- /etc/nginx/sites-enabled/yoursite "$HOME/yoursite.bak.$(date +%Y%m%d-%H%M%S)"`. Edit only this site's config, never `nginx.conf` or another site.
3. Check `nginx -v`. In this site's TLS `server` block, use `http2 on;` alongside the existing `listen 443 ssl;` directives on Nginx 1.25.1 or later. For older versions, add `http2` to the TLS listeners (e.g. `listen 443 ssl http2;` and, if already configured, `listen [::]:443 ssl http2;`). Don't add duplicate listeners.
4. In the same `server` block add:

   ```nginx
   gzip on;
   gzip_vary on;
   gzip_proxied any;
   gzip_comp_level 5;
   gzip_min_length 1024;
   gzip_types text/plain text/css text/javascript application/javascript application/json application/manifest+json image/svg+xml;
   ```

5. Keep `proxy_buffering on;` for normal traffic (`location /`; removing a local `off` is sufficient if no inherited setting disables buffering). Keep `proxy_buffering off;` in a dedicated `location ~ ^/api/(agent/events|deploy/terminal/ws)$` or equivalent exact-match locations. Carry over the existing `proxy_pass` target, auth directives and forwarded headers for these requests; keep WebSocket upgrade handling and the existing streaming timeouts. Disable Nginx gzip in the streaming location so SSE events aren't delayed.
6. Run `sudo nginx -t` and then `sudo systemctl reload nginx` only if validation succeeds. Verify the app, SSE, the terminal and other TLS sites still work. Restore the backup and validate before reloading if you need to roll back.

## Verify the deployment

Use the site's normal authentication when required. For the static tests, set `origin` to the public HTTPS URL and replace `$etag` with the `ETag` value from the first request (including quotes):

```bash
curl -sS --http2 --compressed -D - -o /dev/null -w 'HTTP/%{http_version}\n' "$origin/field.mjs"
curl -sS --http2 -H "If-None-Match: $etag" -D - -o /dev/null -w 'body: %{size_download} bytes\n' "$origin/field.mjs"
```

Expect HTTP/2 and `Content-Encoding: gzip` on the first request and `304` with zero body bytes on the second. Repeat for a large `.fs` asset. In browser DevTools, load the `library` example with the same session and network conditions used for the baseline. Verify the 54 `books` and 268 `insights` rows and inspect the request count, timings and response headers for `/api/data/batch`. Compare the table-load and full-reload wall times to your baseline; extra pages, chunks, imported tables, and capability bootstrap can add requests. A batch payload of at least 1 KiB should be gzip-encoded if the client advertises gzip. If there are many individual KV GETs, check that Nginx forwards `POST /api/data/batch` to the upgraded `start` server and that the browser is running the new app shell.
