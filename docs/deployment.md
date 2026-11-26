# Deploy to GitHub Pages

The production build is a static site in `dist/`. The [Pages workflow](../.github/workflows/pages.yml) runs checks on pull requests and publishes from `main`.

1. Add the project to a GitHub repository, including `package-lock.json`. Use `main` as the default branch and enable GitHub Actions.
2. In **Settings → Pages**, choose **GitHub Actions** as the publication source.
3. Check the `base` in [vite.config.ts](../vite.config.ts). The default `/` serves the app at the root of a domain. For a project site such as `https://<owner>.github.io/<repo>/`, set the base to `/<repo>/` before building.
4. If using a custom subdomain, enter it in Pages settings first. At the DNS provider, create a CNAME for the subdomain pointing to `<owner>.github.io`. Keep the repository path out of the DNS record. The workflow does not require a CNAME file.
5. Push to `main` or run **Check and publish N-back** manually from that branch. The workflow verifies recordings, builds the site, checks the bundled dependency notices and runs the browser tests before uploading and deploying `dist/`. Later commits to a pull request cancel its superseded checks. An active `main` deployment can finish.
6. For a custom domain, wait for domain verification and certificate issuance, then enable **Enforce HTTPS**. Open the HTTPS site on the intended devices and check fonts, sound and a complete round.
