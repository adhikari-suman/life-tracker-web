import { Route, Routes } from 'react-router'
import { AppShell } from './layouts/AppShell'
import { AuthLayout } from './layouts/AuthLayout'
import { LoginPage } from './routes/LoginPage'
import { LedgerPage } from './routes/LedgerPage'
import { SetupPage } from './routes/SetupPage'
import { AccountsPage } from './routes/AccountsPage'
import { ReportsPage } from './routes/ReportsPage'
import { TransactionDetailPage } from './routes/TransactionDetailPage'
import {
  RedirectIfSignedIn,
  RequireAccounts,
  RequireSession,
  RequireSetupPending,
} from './routes/guards'
import {
  ForgotPasswordPage,
  NotFoundPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './routes/placeholders'

/**
 * The ten routes from the information architecture, and nothing else.
 *
 * The nesting IS the redirect chain. Every authenticated route sits inside RequireSession, and
 * the ledger routes sit inside RequireAccounts as well, so the order the IA specifies — no
 * session, then no accounts, then the requested route — is a structural property of this tree
 * rather than a rule each page has to remember. Putting a route in the wrong block is a visible
 * mistake here; forgetting a check inside a page would not be.
 */
export default function App() {
  return (
    <Routes>
      {/* ---------------------------------------------------------------- unauthenticated -- */}
      <Route element={<AuthLayout />}>
        {/* Pointless with a session open — you cannot sign in twice, or register as someone you
            already are. */}
        <Route element={<RedirectIfSignedIn />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Deliberately reachable with OR without a session. A signed-in user can want a
            password reset, and /verify-email is opened from an emailed link by someone who is
            usually already signed in — bouncing them to the ledger would spend the token's one
            use and tell them nothing. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* ------------------------------------------------------------------ authenticated -- */}
      <Route element={<RequireSession />}>
        {/* Chrome-free on purpose: there is nothing to navigate away to until the Book works, so
            the shell is not rendered around it. */}
        <Route element={<RequireSetupPending />}>
          <Route path="/setup" element={<SetupPage />} />
        </Route>

        <Route element={<RequireAccounts />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<LedgerPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/transactions/:id" element={<TransactionDetailPage />} />
          </Route>
        </Route>
      </Route>

      {/* Outside every guard. An unknown address is not a permission problem, and answering one
          with a redirect to /login would tell an anonymous visitor that the address exists. */}
      <Route
        path="*"
        element={
          <AuthLayout>
            <NotFoundPage />
          </AuthLayout>
        }
      />
    </Routes>
  )
}
