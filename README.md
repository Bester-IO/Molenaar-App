# Molenaar Companion

Molenaar Companion is a responsive Progressive Web App that can be installed on laptops, phones, and tablets through the browser.

## Staff sign-in

The app now supports Google and Microsoft sign-in through Firebase Authentication.

1. Create a Firebase project and add a Web app.
2. Enable `Google` and `Microsoft` in `Authentication > Sign-in method`.
3. Add your public site domain to Firebase authorized domains:
	- `bester-io.github.io`
	- `localhost`
4. Copy `.env.example` to `.env.local` and fill in the Firebase values.
5. In GitHub, add the same values for deployment:
	- `Settings > Secrets and variables > Actions`
	- Add `VITE_FIREBASE_API_KEY` as a repository secret
	- Add `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_ALLOWED_EMAILS`, and `VITE_ALLOWED_DOMAINS` as repository variables
6. Optionally restrict access with `VITE_ALLOWED_EMAILS` or `VITE_ALLOWED_DOMAINS`.

Example:

```bash
VITE_ALLOWED_DOMAINS=yourcompany.com
```

If both allowlist variables are empty, any authenticated Google or Microsoft account allowed by Firebase can sign in.

## Run locally

1. Install dependencies with `npm.cmd install`
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