# Molenaar Companion

Molenaar Companion is a responsive Progressive Web App that can be installed on laptops, phones, and tablets through the browser.

## Run locally

1. Install dependencies with `npm install`
2. Start the dev server with `npm run dev`
3. Open the local URL in your browser

## Build for production

Run `npm run build` to generate the production files in `dist/`.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder to the `main` branch.
2. In GitHub, open `Settings > Pages` and set `Source` to `GitHub Actions`.
3. Push to `main` and the workflow in `.github/workflows/deploy-pages.yml` will publish the app.
4. Your public URL will be `https://<your-github-username>.github.io/<your-repo-name>/`.

The app is configured with relative asset paths so it works from a GitHub Pages repository subpath.

## Install on a device

- On Chrome or Edge, use the install button in the browser or the in-app Install app button.
- On iPhone or iPad, open the Share menu in Safari and choose Add to Home Screen.