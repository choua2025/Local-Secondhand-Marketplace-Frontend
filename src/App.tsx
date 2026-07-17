import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { UnreadProvider } from './context/UnreadContext';
import { BrowsePage } from './pages/BrowsePage';
import { CreateListingPage } from './pages/CreateListingPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditListingPage } from './pages/EditListingPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { LoginPage } from './pages/LoginPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

/**
 * AuthProvider sits inside BrowserRouter because Navbar and the auth pages use
 * router hooks, and outside Routes because every route needs the session.
 *
 * FavoritesProvider nests inside AuthProvider: it reads `user` to know when to
 * load the saved ids and when to clear them on logout.
 *
 * RealtimeProvider also nests inside AuthProvider — it opens the WebSocket only
 * while someone is logged in — and wraps UnreadProvider, because the unread
 * badge subscribes to the socket to update live.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <RealtimeProvider>
            <UnreadProvider>
            {/*
             * A flex column so the footer is pushed to the bottom of the
             * viewport on a short page — the 404, an empty dashboard — instead
             * of floating halfway up with blank space beneath it. `flex-1` on
             * <main> is what claims that leftover space.
             */}
            <div className="flex min-h-screen flex-col bg-slate-50">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<BrowsePage />} />
                  <Route path="/listing/:id" element={<ListingDetailPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Public by necessity: the emailed token is the only credential
                      someone locked out of their account can present. */}
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  <Route
                    path="/sell"
                    element={
                      <ProtectedRoute>
                        <CreateListingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/listing/:id/edit"
                    element={
                      <ProtectedRoute>
                        <EditListingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <ProtectedRoute>
                        <MessagesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
            </UnreadProvider>
          </RealtimeProvider>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <a href="/" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
        Back to browse
      </a>
    </div>
  );
}
