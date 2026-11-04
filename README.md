# FRAME — film discovery

A responsive film discovery app rebuilt from the original GraphQL workshop. Browse a sample catalog immediately, filter by genre, search titles, open film details, and keep a watchlist in this browser. It does not stream films.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. The sample catalog is bundled at `public/catalog.csv`, so no database account or secret is needed for local use. `npm run build` creates the static site in `dist/`.

## Optional Astra GraphQL catalog

The app can load catalog data through Netlify Functions. Deploy this repository to Netlify and set these server-side environment variables in the site settings:

- `ASTRA_GRAPHQL_ENDPOINT`: the Astra Data API GraphQL HTTPS endpoint
- `ASTRA_DB_APPLICATION_TOKEN`: a scoped token with read access only

The token is read only by server functions and never included in browser assets. When the provider is unavailable or not configured, the bundled sample catalog remains usable. The functions accept POST requests only, bound request sizes, validate inputs, and time out upstream requests.

For local function development, install the Netlify CLI separately and run `npx netlify-cli dev`; this proxies the frontend and functions. Do not commit `.env` files or live credentials.

## Deployment

Netlify uses `npm run build`, publishes `dist`, and deploys the functions in `functions/`. A static host can also serve `dist` with the sample catalog; Astra-backed loading requires Netlify Functions.

## Project notes

- React 19, Vite 8, plain CSS, and Netlify Functions
- Keyboard-friendly controls and responsive layouts
- Saved titles use browser local storage on this device
- Movie metadata is workshop/sample content and availability is not represented
