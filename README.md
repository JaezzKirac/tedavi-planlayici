# Treatment Planner (React + Vite + Three.js)

3D implant / crown / extraction / bone graft treatment plans for Clinic Group.
Staff sign in, mark the teeth on a dental chart, play the 3D treatment animation and generate a
patient link + QR code. Generating the link saves the patient to the dashboard of the staff member who made it.

## Users
| User | Role |
|---|---|
| Thomas, Marian, Anxhela, Yağız, Adrian, Medo | staff: sees only their own patients |
| Marko | admin: sees every patient, can filter by staff member |

Passwords and the session secret are in `api/_lib/secrets.js` (temporary, hard-coded). **Keep the GitHub repo private**,
otherwise anyone can read them. To change a password, edit the value and redeploy. An environment variable with the
same name (e.g. `MARKO_PASSWORD`) overrides the value in the file. To add a person, add a line to `api/_lib/users.js`,
`STAFF` in `src/config.js` and `<ID>_PASSWORD` in `secrets.js`.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173  (API included, data saved to .data/db.json)
npm run build      # production build -> dist/
```

## Deploy to Vercel
1. Push this folder to a **private** GitHub repo and import it in Vercel (framework: Vite). No environment variables needed.
2. For the shared dashboard, create a free database at upstash.com → **Redis → Create database**, open its
   **REST API** section and paste the URL and token into `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   in `api/_lib/secrets.js`.
3. Push again; Vercel redeploys automatically.

## Patient links
- Links end in `#p=...`: the plan is encoded in the link and the part after `#` is never sent to the server.
  Patients don't need an account; anyone with the link can see that plan.
- "Show initials" (on by default) puts "J. S." in the link instead of the full name.
  The dashboard always stores the full name.

## Structure
```
api/                      Vercel serverless functions
  login.js logout.js me.js  session (signed HttpOnly cookie)
  plans.js                list / create / update patient records
  _lib/                   users, secrets, password check, auth, storage (Upstash Redis or local file)
src/
  App.jsx                 patient view (#p=) or staff app (sign in, dashboard, create flow)
  config.js               clinic name / phone, staff list for the sign-in screen
  components/
    Login.jsx Dashboard.jsx Intake.jsx ChartScreen.jsx ToothChart.jsx PlanView.jsx SharePanel.jsx
  three/JawScene.js       3D jaw, implant, crown, extraction, graft animations (Three.js r128)
  data/teeth.js           tooth geometry, names, sample patient
  data/timeline.js        treatment steps and animation timeline
  lib/share.js            link encoding / decoding
  lib/api.js              API calls
```
