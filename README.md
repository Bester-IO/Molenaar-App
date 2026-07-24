# Molenaar Companion

Molenaar Companion is a responsive Progressive Web App that can be installed on laptops, phones, and tablets through the browser.

## Local database features

The app now includes an in-browser IndexedDB database with two entities:

1. Projects
- Project name
- Project number
- Project location

2. Peloton members
- Name
- Surname
- Employee number
- Qualification
- Linked project (optional)
- PDF attachments linked to the member profile

Notes:
- Data is stored locally on each device/browser.
- PDF files are stored in IndexedDB as blobs and can be downloaded from the member profile list.

## Shared database mode (multi-device)

The app can use a shared backend database so all devices see the same projects/members.

### Start backend server

1. Install backend dependencies:
	- `npm.cmd run server:install`
2. Start backend:
	- `npm.cmd run server:dev`
3. Backend URL:
	- `http://localhost:8787`

### Connect app to shared database

1. Open the app and go to `Settings`.
2. Paste the API URL in `Shared database API URL`.
3. Click `Use shared database`.

When connected, Projects and Peloton Members are stored in SQLite on the server (including linked PDF files).

## Access mode

The app is currently public and does not require sign-in.

## Run locally

1. Install dependencies with `npm.cmd install`
2. Start the dev server with `npm.cmd run dev`
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