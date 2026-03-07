import { Suspense, useEffect } from "react";
import { ThemeModeProvider } from "../_metronic/partials";
import { Outlet } from "react-router-dom";
import { I18nProvider } from "../_metronic/i18n/i18nProvider";
import { MasterInit } from "../_metronic/layout/MasterInit";
import { LayoutSplashScreen, LayoutProvider } from "../_metronic/layout/core";
import { AuthInit } from "./modules/auth";
import { Toaster } from "sonner"

const App = () => {
  // useEffect(() => {
  //   const preventCopyPaste = (event: { preventDefault: () => void }) => {
  //     event.preventDefault();
  //     alert("Copy and paste functionality is restricted in this application.");
  //   };

  //   document.addEventListener("copy", preventCopyPaste);
  //   document.addEventListener("paste", preventCopyPaste);

  //   return () => {
  //     document.removeEventListener("copy", preventCopyPaste);
  //     document.removeEventListener("paste", preventCopyPaste);
  //   };
  // }, []);

  return (
    <Suspense fallback={<LayoutSplashScreen />}>
      <I18nProvider>
        <LayoutProvider>
          <ThemeModeProvider>
            <AuthInit>
              <Outlet />
              <MasterInit />
              <Toaster />
            </AuthInit>
          </ThemeModeProvider>
        </LayoutProvider>
      </I18nProvider>
    </Suspense>
  );
};

export { App };
