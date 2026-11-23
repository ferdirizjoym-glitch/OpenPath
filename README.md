# OpenPath

// ROUTINE UPDATES
// git add .
// git commit -m "Message"
// git push origin main

// GETTING UPDATES
// git pull origin main

// github repo: https://github.com/ferdirizjoym-glitch/OpenPath

// GET TO MAIN BRANCH
// git switch main

## Deploy to Vercel

OpenPath keeps its HTML, CSS, JavaScript, and images as static project files. Vercel serves the public pages and runs the API routes in `api/`. The local `node server.js` command remains for local development.

### One-time Vercel setup

1. Import this repository into Vercel with the project root as the Root Directory. Leave the Build Command and Output Directory empty; this project has no build step.
2. In the Vercel project's **Storage** page, create and connect an **Upstash Redis** database. The integration supplies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the deployment.
3. Add an `OPENPATH_SETUP_TOKEN` environment variable in Vercel. Use a long, private, one-time value. Redeploy after adding the storage and environment variables.
4. Open `/admin/protected` on the deployed site, enter the setup token, and create the first admin account. The setup token is only used while no admin account exists.

The first API request copies the public destinations in `data/places.json` into Redis. Community requests, admin accounts, sign-in sessions, and uploaded destination images are stored in Redis after setup. New destination image uploads are limited to 3 MB to stay within Vercel's function request-size limit. Local `data/admins.json` and `data/requests.json` are excluded from the Vercel deployment; the deployment starts with a fresh admin and request queue.

Without Redis credentials, Vercel can still serve the public pages and bundled destination list, but admin changes and suggestion submissions cannot be saved. Connect storage before expecting those features to work.
