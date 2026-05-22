import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { NotificationProvider } from "./lib/notification";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PlatformHome } from "./pages/PlatformHome";
import { Organizations } from "./pages/Organizations";
import { PlatformUsage } from "./pages/PlatformUsage";
import { RepoDetail } from "./pages/RepoDetail";
import { PRDetail } from "./pages/PRDetail";
import { Settings } from "./pages/Settings";
import { Analytics } from "./pages/Analytics";
import { Agents } from "./pages/Agents";
import { Team } from "./pages/Team";
import { OrganizationDetailsPage } from "./pages/OrganizationDetails";
import { Profile } from "./pages/Profile";

function HomeSwitch() {
  const { user } = useAuth();
  if (user?.role === "platform_admin") return <PlatformHome />;
  return <Dashboard />;
}

function AppRoutes() {
  const navigate = useNavigate();
  return (
    <NotificationProvider navigate={(path) => navigate(path)}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeSwitch />} />
          <Route
            path="organizations"
            element={
              <ProtectedRoute roles={["platform_admin"]}>
                <Organizations />
              </ProtectedRoute>
            }
          />
          <Route
            path="platform-usage"
            element={
              <ProtectedRoute roles={["platform_admin"]}>
                <PlatformUsage />
              </ProtectedRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <ProtectedRoute roles={["org_admin", "developer"]}>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="agents"
            element={
              <ProtectedRoute roles={["org_admin", "developer"]}>
                <Agents />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route
            path="organization"
            element={
              <ProtectedRoute roles={["org_admin"]}>
                <OrganizationDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="team"
            element={
              <ProtectedRoute roles={["org_admin"]}>
                <Team />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute roles={["org_admin"]}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="repos/:repoId"
            element={
              <ProtectedRoute roles={["org_admin", "developer"]}>
                <RepoDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="prs/:prId"
            element={
              <ProtectedRoute roles={["org_admin", "developer"]}>
                <PRDetail />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </NotificationProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
