import React from "react";
import clsx from "clsx";
import { KTIcon, toAbsoluteUrl } from "../../../helpers";
import { HeaderUserMenu, ThemeModeSwitcher } from "../../../partials";
import { useAuth } from "../../../../app/modules/auth";
import { useLayout } from "../../core";

const Navbar = () => {
  const { currentUser } = useAuth();
  const { config } = useLayout();
  const itemClass = "ms-1 ms-md-4";
  const btnClass =
    "btn btn-icon btn-custom btn-icon-muted btn-active-light btn-active-color-primary w-35px h-35px";
  const userAvatarClass = "symbol-35px";
  const btnIconClass = "fs-2";

  return (
    <div className="app-navbar flex-shrink-0">
      {/* <div className={clsx('app-navbar-item align-items-stretch', itemClass)}>
        <Search />
      </div> */}

      {/* <div className={clsx('app-navbar-item', itemClass)}>
        <div id='kt_activities_toggle' className={btnClass}>
          <KTIcon iconName='chart-simple' className={btnIconClass} />
        </div>
      </div> */}

      {/* <div className={clsx("app-navbar-item", itemClass)}>
        <div
          data-kt-menu-trigger="{default: 'click'}"
          data-kt-menu-attach="parent"
          data-kt-menu-placement="bottom-end"
          className={btnClass}
        >
          <KTIcon iconName="element-plus" className={btnIconClass} />
        </div>
      </div> */}

      {/* <div className={clsx("app-navbar-item", itemClass)}>
        <div
          className={clsx("position-relative", btnClass)}
          id="kt_drawer_chat_toggle"
        >
          <KTIcon iconName="message-text-2" className={btnIconClass} />
          <span className="bullet bullet-dot bg-success h-6px w-6px position-absolute translate-middle top-0 start-50 animation-blink" />
        </div>
      </div> */}

      {/* <div className={clsx("app-navbar-item", itemClass)}>
        <ThemeModeSwitcher
          toggleBtnClass={clsx("btn-active-light-primary btn-custom")}
        />
      </div> */}

      {/* New Code for User Name */}
      <div className="menu-item px-3">
        <div className="menu-content d-flex align-items-center px-3">
          <div className="d-flex flex-column pt-1">
            <div className="fw-bolder d-flex align-items-center fs-5 text-light">
              Admin User
            </div>
            <a href="#" className="fw-bold text-muted text-hover-primary fs-7">
              {currentUser?.email}
            </a>
          </div>
        </div>
      </div>
      {/* New Code for User Name */}

      <div className={clsx("app-navbar-item", itemClass)}>
        <div
          className={clsx("cursor-pointer symbol", userAvatarClass)}
          data-kt-menu-trigger="{default: 'click'}"
          data-kt-menu-attach="parent"
          data-kt-menu-placement="bottom-end"
        >
          <i className="fa-solid fa-user user-icon-navbar"></i>
        </div>
        <HeaderUserMenu />
      </div>

      {config.app?.header?.default?.menu?.display && (
        <div
          className="app-navbar-item d-lg-none ms-2 me-n3"
          title="Show header menu"
        >
          <div
            className="btn btn-icon btn-active-color-primary w-35px h-35px"
            id="kt_app_header_menu_toggle"
          >
            <KTIcon iconName="text-align-left" className={btnIconClass} />
          </div>
        </div>
      )}
    </div>
  );
};

export { Navbar };
