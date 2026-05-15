# LoopGain landing page

Source for `https://loopgain.ai/` — the marketing landing for [`loopgain`](https://github.com/loopgain-ai/loopgain) (the Barkhausen stability monitor for AI agent loops).

Static single-page site. No build step: `index.html` pulls in `landing.css` and `landing.js` directly. Cloudflare Pages serves it; `_headers` configures the security-header set (CSP, HSTS, X-Frame-Options, etc.).

## Local preview

Any static server works. For example:

```sh
python3 -m http.server 5174
```

Then open `http://localhost:5174/`.

## Deploy

Connected to Cloudflare Pages — pushing to `main` auto-deploys. The production custom domain is `loopgain.ai` (apex).

For a one-off manual deploy from local:

```sh
npx wrangler pages deploy . --project-name=loopgain-landing
```

## License

Apache-2.0. See [LICENSE](LICENSE).
