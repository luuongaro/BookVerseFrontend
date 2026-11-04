# Password recovery

`/forgot-password` and `/reset-password` are public routes. Login links to the first one; both use the existing auth layout. Recovery requests use AuthService and the environment API URL.

The backend counterpart is `feature/password-recovery` in BookVerseBackend. Before deploying that backend, apply its `docs/sql/password-recovery.sql` migration to Supabase and configure Resend delivery following its `docs/resend-email.md`. See the backend's `docs/password-recovery.md` for the deployment order and API contract.

The reset email must use `/reset-password#token=...`, with the 43-character URL-safe token. The page removes the fragment from the address bar and keeps the token only in memory. Refreshing the page requires reopening the email link. Tokens are not saved to browser storage.

The form checks password strength, BCrypt's input limit and matching confirmation, blocks duplicate submissions, handles temporary failures with retry, and offers a new link when the previous one is missing, invalid or expired. Successful reset clears the local session and returns the user to the normal login flow.

Verification:

```sh
cd BookVerseFrontend
npm run build
npm test -- --watch=false --include='src/app/features/auth/**/*.spec.ts' --include='src/app/core/services/auth.spec.ts'
```

19 focused auth tests pass. The complete existing suite remains blocked by an unrelated stale LibraryStory fixture in my-library.spec.ts. The production build succeeds with the existing initial bundle budget warning. No changes have been deployed and live mail delivery has not been verified.
