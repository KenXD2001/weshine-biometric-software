import { lazy, FC, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { MasterLayout } from "../../_metronic/layout/MasterLayout";
import TopBarProgress from "react-topbar-progress-indicator";
import { getCSSVariableValue } from "../../_metronic/assets/ts/_utils";
import { WithChildren } from "../../_metronic/helpers";

// Biometric System Pages

import { BiometricSystem } from "../pages/BiometricSystem";
import { BiometricCandidateList } from "../pages/BiometricCandidateList";

const PrivateRoutes = () => {
  const AccountPage = lazy(() => import("../modules/accounts/AccountPage"));

  return (
    <Routes>
      <Route element={<MasterLayout />}>
        <Route path="auth/*" element={<Navigate to="/biometric-system" />} />
        {/* Pages */}
        <Route path="biometric-system" element={<BiometricSystem />} />
        <Route
          path="candidate-biometric-list"
          element={<BiometricCandidateList />}
        />

        {/* Pages */}

        {/* Lazy Modules */}
        <Route
          path="crafted/pages/profile/*"
          element={<SuspensedView></SuspensedView>}
        />
        <Route
          path="crafted/pages/wizards/*"
          element={<SuspensedView></SuspensedView>}
        />
        <Route
          path="crafted/widgets/*"
          element={<SuspensedView></SuspensedView>}
        />
        <Route
          path="crafted/account/*"
          element={
            <SuspensedView>
              <AccountPage />
            </SuspensedView>
          }
        />
        <Route path="apps/chat/*" element={<SuspensedView></SuspensedView>} />
        <Route
          path="apps/user-management/*"
          element={<SuspensedView></SuspensedView>}
        />
        {/* Page Not Found */}
        <Route path="*" element={<Navigate to="/error/404" />} />
      </Route>
    </Routes>
  );
};

const SuspensedView: FC<WithChildren> = ({ children }) => {
  const baseColor = getCSSVariableValue("--bs-primary");
  TopBarProgress.config({
    barColors: {
      "0": baseColor,
    },
    barThickness: 1,
    shadowBlur: 5,
  });
  return <Suspense fallback={<TopBarProgress />}>{children}</Suspense>;
};

export { PrivateRoutes };
