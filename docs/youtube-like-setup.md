# Like on YouTube: setup

An opt-in **Like** button beside Save and Share on the watch page. It records the like on the
viewer's own YouTube account (and in their "Liked videos"), without leaving the site. The YouTube
embed has no like button and the IFrame Player API cannot like, so the app calls the YouTube Data
API directly, with an OAuth token from Google Identity Services (GIS).

## How it works

- **Off by default.** With `VITE_YT_CLIENT_ID` unset the button, the Privacy-panel section and the
  extra CSP origins are all absent, and the app contacts exactly the hosts it did before.
- **Lazy.** Nothing contacts Google until a viewer presses Like. That first press loads
  `https://accounts.google.com/gsi/client`, opens Google's sign-in popup, then calls the API.
- **Token in memory only** (token model, about an hour). Never written to any storage; gone on
  reload. Privacy panel > "Like on YouTube" > **Disconnect YouTube** revokes it at Google.
- **Calls** (`src/lib/ytLike.ts`): `GET videos/getRating?id=` after sign-in;
  `POST videos/rate?id=&rating=like` to like, `rating=none` to unlike. A video already liked shows
  as liked; signing in never unlikes it.
- **Scope:** `https://www.googleapis.com/auth/youtube.force-ssl`. `videos.rate` accepts only
  `youtubepartner`, `youtube` and `youtube.force-ssl`. Of these, `force-ssl` is the narrowest in
  wording ("See, edit, and permanently delete your YouTube videos, ratings, comments and
  captions"; `youtube` is "Manage your YouTube account"). There is no rate-only scope, and
  `youtube.readonly` is accepted by `getRating` but not by `rate`.
- **Hidden in the lite profile** (TVs and Chromium older than 100): GIS needs a popup window and a
  pointer, which TV browsers and remotes do not give. Elsewhere, any failure shows "Couldn't reach
  YouTube".
- **CSP note:** with a fake client ID, GIS's popup logged one "Applying inline style" violation
  against the strict `style-src`. The CSP is deliberately not loosened (`'unsafe-inline'`). Confirm
  with a real client ID that sign-in still completes; this was not testable without one.

## Part 1: for the developer now

1. **Project.** In the [Google Cloud console](https://console.cloud.google.com/projectcreate)
   create a project.
2. **Enable the API.** APIs & Services > Library > "YouTube Data API v3" > Enable.
3. **Consent screen** (Google Auth platform > Branding and Audience; help:
   <https://support.google.com/cloud/answer/15549945>): user type **External**; publishing status
   **Testing**; fill app name, support email and developer contact. Data Access > add the scope
   `https://www.googleapis.com/auth/youtube.force-ssl`. Audience > **Test users**: add the Google
   accounts that will try it (**maximum 100**). In Testing, authorizations expire after 7 days and
   an "unverified app" warning shows.
4. **OAuth client.** Credentials > Create credentials > OAuth client ID > **Web application**.
   Under _Authorized JavaScript origins_ add `https://ralmodiel.github.io` and
   `http://localhost:5280` (plus any other dev origin, e.g. `http://localhost:5173`). Origins have
   no path or trailing slash. No redirect URI is needed for the token-model popup. Copy the
   **Client ID**; there is no secret to keep.
5. **Repo variable.** GitHub repo > Settings > Secrets and variables > Actions > **Variables** >
   New repository variable `YT_CLIENT_ID` = the client ID. `.github/workflows/deploy.yml` passes it
   to the build as `VITE_YT_CLIENT_ID`. Re-run the deploy workflow (the value is baked in at build
   time).
6. **Local try.** Copy `.env.example` to `.env.local`, set `VITE_YT_CLIENT_ID=...`, run
   `npm run dev` (the dev origin must be authorized). The CSP applies to production builds only.
7. **Try it.** Open a video, press Like, sign in as a test user, accept. The button turns gold
   ("Liked"); the video appears in youtube.com/playlist?list=LL. Press again to unlike. Privacy
   panel > Disconnect YouTube.

**Quota** ([cost table](https://developers.google.com/youtube/v3/determine_quota_cost)): the default
is **10,000 units per day** per project (resets at midnight Pacific). `videos.rate` costs **50**
units, `videos.getRating` **1**. A first like (rating check plus rate) is 51 units, so about **195
likes per day** across all viewers. Past that the API returns quota errors and the button shows
"Couldn't reach YouTube". More quota needs the audit and extension form (Part 2, step 9).

## Part 2: for UPOU, when it adopts the app

1. **Own the project.** Create (or transfer) the Google Cloud project under a UPOU Google Cloud
   organization, with a UPOU group as Owners, not one person. Use a monitored support email:
   Google sends notices to project contacts, and ignoring them can lose API access.
2. **Host on a UPOU domain** (e.g. `oer.upou.edu.ph`) and add that origin as an Authorized
   JavaScript origin. Rebuild with `VITE_SITE_URL` and `BASE_PATH` for the new host (README,
   "Deploying to GitHub Pages").
3. **Verify the domain** in [Google Search Console](https://search.google.com/search-console) with
   an account that owns the Cloud project, then list it under Branding > Authorized domains.
4. **Homepage and privacy policy** (branding verification:
   <https://support.google.com/cloud/answer/13464321>). Both must be public, on the verified
   domain, and not behind a login. The homepage must describe the app and link the policy. The
   policy must say how the app accesses, uses, stores and shares Google user data. For this app,
   state plainly:
   - the only Google data accessed is the viewer's like/none rating of a video (read and write)
     through the YouTube Data API;
   - it is used only to show and change that rating;
   - the token is kept in browser memory only and is never stored or sent to UPOU servers;
   - nothing is shared, sold or used for advertising;
   - viewers can revoke at any time with the in-app Disconnect and at
     <https://myaccount.google.com/permissions>.

   It should also say the app uses YouTube API Services, link the
   [YouTube Terms of Service](https://www.youtube.com/t/terms) and the
   [Google Privacy Policy](https://policies.google.com/privacy), and comply with the
   [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
   including Limited Use.

5. **Branding.** App name, logo, support email and developer contact, all matching the homepage.
   Keep the "Proof of concept" label until UPOU decides otherwise.
6. **Scope classification.** The Cloud console marks each scope non-sensitive, sensitive or
   restricted once added (Data Access), and Google advises preferring a non-sensitive scope where
   scopes overlap (<https://developers.google.com/identity/protocols/oauth2/scopes>). **Not
   verified:** the public pages read for this setup do not state the class of `youtube.force-ssl`.
   Read it in the console after adding the scope. **Sensitive** needs the verification in step 7.
   **Restricted** also needs an annual third-party security assessment (CASA), per the
   [restricted-scope verification guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
   If that happens, weigh it against the value of a like button before going on.
7. **Submit for verification** (Google Auth platform > Verification Center; guide:
   <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>):
   - **Scope justification**, for example: "The app plays openly licensed educational videos from
     the university's YouTube channel. The Like button lets a signed-in viewer like the video they
     are watching so it is recorded on their YouTube account. We call videos.getRating to show the
     current state and videos.rate to set or remove a like, and read and write nothing else. No
     narrower scope permits videos.rate."
   - **Demo video** (English, unlisted link): the whole flow with the app name and the OAuth client
     ID visible, the full consent screen, the Like press, the like appearing on YouTube, and
     Disconnect.
   - Up to three links documenting the feature (the privacy policy and this guide's substance).
   - **Timeline:** Google estimates **3-5 business days** for the review, plus any back-and-forth,
     so budget longer for a first round. A compliant result is valid for 7 days, so publish
     promptly after approval. Set Publishing status to **In production** to leave the 100
     test-user limit.
8. **YouTube API Services compliance.** Data API use is also bound by the
   [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
   and [Developer Policies](https://developers.google.com/youtube/terms/developer-policies). Have
   UPOU's counsel read them; this app stores no API data and shows the viewer that YouTube is
   involved only through the sign-in popup and the Privacy panel text.
9. **More quota.** If 10,000 units/day is not enough, complete the **YouTube API Services - Audit
   and Quota Extension Form**
   (<https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>). A compliance
   audit comes first and YouTube gives no fixed response time. A change of control of the API
   project (for example moving it to UPOU) needs YouTube's Change of Control form, so file it at the
   transfer.

## Sources

- videos.rate: <https://developers.google.com/youtube/v3/docs/videos/rate>
- videos.getRating: <https://developers.google.com/youtube/v3/docs/videos/getRating>
- Quota: <https://developers.google.com/youtube/v3/determine_quota_cost>
- GIS token model: <https://developers.google.com/identity/oauth2/web/guides/use-token-model>
- GIS CSP: <https://developers.google.com/identity/gsi/web/guides/client-library>
- Scopes: <https://developers.google.com/identity/protocols/oauth2/scopes> and
  <https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps>
- Consent screen and test users: <https://support.google.com/cloud/answer/15549945>
- Verification: <https://support.google.com/cloud/answer/13464321>
