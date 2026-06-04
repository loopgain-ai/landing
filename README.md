# LoopGain landing page

Source for `https://loopgain.ai/` — the marketing landing for [`loopgain`](https://github.com/loopgain-ai/loopgain) (an open-source cost controller for AI agent loops).

Static single-page site. No build step: `index.html` pulls in `landing.css` and `landing.js` directly. Deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`); `_headers` configures the response-header set (CSP, HSTS, X-Frame-Options, etc.).

## Local preview

Any static server works. For example:

```sh
python3 -m http.server 5174
```

Then open `http://localhost:5174/`.

## Deploy

Connected to Cloudflare via Git — pushing to `main` auto-deploys. The production custom domain is `loopgain.ai` (apex).

For a one-off manual deploy from local:

```sh
npx wrangler deploy
```

The `.assetsignore` file excludes repo-management files (README, LICENSE, etc.) from being uploaded as servable assets.

## License

Apache-2.0. See [LICENSE](LICENSE).
