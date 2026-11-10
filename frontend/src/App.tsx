import { Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MaterialsPage } from "@/pages/MaterialsPage";
import { TopicMapPage } from "@/pages/TopicMapPage";
import { QuizPage } from "@/pages/QuizPage";
import { QuizTakePage } from "@/pages/QuizTakePage";
import { QuizResultsPage } from "@/pages/QuizResultsPage";
import { GapReportPage } from "@/pages/GapReportPage";
import { RevisionPlanPage } from "@/pages/RevisionPlanPage";
import { AssistantPage } from "@/pages/AssistantPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/topics" element={<TopicMapPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/quiz/:quizId/take" element={<QuizTakePage />} />
          <Route path="/quiz/:quizId/results" element={<QuizResultsPage />} />
          <Route path="/gaps" element={<GapReportPage />} />
          <Route path="/revision" element={<RevisionPlanPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
