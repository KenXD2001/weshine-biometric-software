import React, { useState } from "react";
import { useIntl } from "react-intl";
import { SidebarMenuItem } from "./SidebarMenuItem";

const SidebarMenuMain = () => {
  const intl = useIntl();

  // State to manage the visibility of dropdown menus
  const [showMenu, setShowMenu] = useState({
    superAdmin: false,
    admin: false,
    regionalHead: false,
    chiefInvigilator: false,
    allCombined: false,
  });

  // Function to toggle the visibility of dropdown menus
  const toggleMenu = (menu) => {
    setShowMenu((prevState) => ({
      ...prevState,
      [menu]: !prevState[menu],
    }));
  };

  return (
    <>
      {/* Main Menu - Super Admin */}
      <div
        className="sidebar-menu-main"
        style={{
          marginBottom: "20px",
          padding: "5px",
          border: "2px solid rgba(225, 225, 225, 0.5)",
          borderRadius: "8px",
        }}
      >
        <div
          className="sidebar-menu-title"
          onClick={() => toggleMenu("superAdmin")}
        >
          <div>
            <button
              className="btn btn-light fw-bold"
              style={{
                width: "90%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <i
                className="fas fa-user-shield"
                style={{ fontSize: "14px" }}
              ></i>
              Super Admin
            </button>
          </div>
        </div>
        {showMenu.superAdmin && (
          <div
            className="sidebar-menu-dropdown"
            style={{ paddingLeft: "20px", transition: "max-height 0.3s ease" }}
          >
            <SidebarMenuItem
              to="/add-regions"
              icon="element-11"
              title="Add Regions"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-regional-head"
              icon="element-11"
              title="Add Regional Head"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-center-bulk"
              icon="element-11"
              title="Exam Center Bulk Upload"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-exam-center"
              icon="element-11"
              title="Map Region to RH"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-rh-to-exam-centre"
              icon="element-11"
              title="Map RH to Exam Centre"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-manuals"
              icon="element-11"
              title="Upload Exam Manuals"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-list-biometric"
              icon="element-11"
              title="Centre List For Biometric"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/allocationas-status"
              icon="element-11"
              title="Allocations Status Report"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/enable-feedback"
              icon="element-11"
              title="Enable Feedback"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/generate-all-data"
              icon="element-11"
              title="Generate All Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/view-declaration"
              icon="element-11"
              title="View Declaration"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/annexure-status"
              icon="element-11"
              title="View Annexures & Status"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/man-power-list"
              icon="element-11"
              title="Man Power List And Count"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-biometric"
              icon="element-11"
              title="Download Candidate Biometric"
              fontIcon="bi-app-indicator"
            />
            {/* Add more items as needed */}
          </div>
        )}
      </div>

      {/* Main Menu - Admin */}
      <div
        className="sidebar-menu-main"
        style={{
          marginBottom: "20px",
          padding: "5px",
          border: "2px solid rgba(225, 225, 225, 0.5)",
          borderRadius: "8px",
        }}
      >
        <div className="sidebar-menu-title" onClick={() => toggleMenu("admin")}>
          <div>
            <button
              className="btn btn-light fw-bold"
              style={{
                width: "90%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <i
                className="fas fa-user-shield"
                style={{ fontSize: "14px" }}
              ></i>
              Admin
            </button>
          </div>
        </div>
        {showMenu.admin && (
          <div
            className="sidebar-menu-dropdown"
            style={{ paddingLeft: "20px" }}
          >
            <SidebarMenuItem
              to="/add-regions"
              icon="element-11"
              title="Add Regions"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-regional-head"
              icon="element-11"
              title="Add Regional Head"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-exam-center"
              icon="element-11"
              title="Map Region to RH"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-rh-to-exam-centre"
              icon="element-11"
              title="Map RH to Exam Centre"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-mock-data"
              icon="element-11"
              title="Download Mock Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-ci-bulk"
              icon="element-11"
              title="Add CI Bulk"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-zonal-head"
              icon="element-11"
              title="Add Zonal Head"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-zone"
              icon="element-11"
              title="Map Zone To Exam"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-list-biometric"
              icon="element-11"
              title="Centre List For Biometric"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-manuals"
              icon="element-11"
              title="Upload Exam Manuals"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/allocationas-status"
              icon="element-11"
              title="Allocations Status Report"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/annexure-status"
              icon="element-11"
              title="View Annexures & Status"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/man-power-list"
              icon="element-11"
              title="Man Power List And Count"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/view-feedback"
              icon="element-11"
              title="View Feedback"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-center-bulk"
              icon="element-11"
              title="Exam Center Bulk Upload"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/upload-mock-data"
              icon="element-11"
              title="Upload Mock Data"
              fontIcon="bi-app-indicator"
            />
            {/* Add more items as needed */}
          </div>
        )}
      </div>

      {/* Main Menu - Regional Head */}
      <div
        className="sidebar-menu-main"
        style={{
          marginBottom: "20px",
          padding: "5px",
          border: "2px solid rgba(225, 225, 225, 0.5)",
          borderRadius: "8px",
        }}
      >
        <div
          className="sidebar-menu-title"
          onClick={() => toggleMenu("regionalHead")}
        >
          <div>
            <button
              className="btn btn-light fw-bold"
              style={{
                width: "90%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <i
                className="fas fa-user-shield"
                style={{ fontSize: "14px" }}
              ></i>
              Regional Head
            </button>
          </div>
        </div>
        {showMenu.regionalHead && (
          <div
            className="sidebar-menu-dropdown"
            style={{ paddingLeft: "20px" }}
          >
            <SidebarMenuItem
              to="/download-exam-data"
              icon="element-11"
              title="Generate Exam Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-mock-data"
              icon="element-11"
              title="Download Mock Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-generate-main-exam-data"
              icon="element-11"
              title="Download Generated Data - Slotwise
"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/annexure-status"
              icon="element-11"
              title="View Annexures & Status"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/view-declaration"
              icon="element-11"
              title="View Declaration"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/man-power-list"
              icon="element-11"
              title="Man Power List And Count"
              fontIcon="bi-app-indicator"
            />
            {/* Add more items as needed */}
          </div>
        )}
      </div>

      {/* Main Menu - Chief Invigilator */}
      <div
        className="sidebar-menu-main"
        style={{
          marginBottom: "20px",
          padding: "5px",
          border: "2px solid rgba(225, 225, 225, 0.5)",
          borderRadius: "8px",
        }}
      >
        <div
          className="sidebar-menu-title"
          onClick={() => toggleMenu("chiefInvigilator")}
        >
          <div>
            <button
              className="btn btn-light fw-bold"
              style={{
                width: "90%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <i
                className="fas fa-user-shield"
                style={{ fontSize: "14px" }}
              ></i>
              Chief Invigilator
            </button>
          </div>
        </div>
        {showMenu.chiefInvigilator && (
          <div
            className="sidebar-menu-dropdown"
            style={{ paddingLeft: "20px" }}
          >
            <SidebarMenuItem
              to="/center-details"
              icon="element-11"
              title="My Center Details"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-mock-data"
              icon="element-11"
              title="Download Mock Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-generate-main-exam-data"
              icon="element-11"
              title="Download Generated Data - Slotwise"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-staff-decelaration"
              icon="element-11"
              title="Centre Staff Decelaration"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/upload-annexure"
              icon="element-11"
              title="Uplaod Annexure"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-feedback-form"
              icon="element-11"
              title="Centre / Staff Feedback Form"
              fontIcon="bi-app-indicator"
            />
            {/* Add more items as needed */}
          </div>
        )}
      </div>

      {/* Main Menu - All Combined */}
      <div
        className="sidebar-menu-main"
        style={{
          marginBottom: "20px",
          padding: "5px",
          border: "2px solid rgba(225, 225, 225, 0.5)",
          borderRadius: "8px",
        }}
      >
        <div
          className="sidebar-menu-title"
          onClick={() => toggleMenu("allCombined")}
        >
          <div>
            <button
              className="btn btn-light fw-bold"
              style={{
                width: "90%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <i
                className="fas fa-user-shield"
                style={{ fontSize: "14px" }}
              ></i>
              All Roles Combined
            </button>
          </div>
        </div>
        {showMenu.allCombined && (
          <div
            className="sidebar-menu-dropdown"
            style={{ paddingLeft: "20px" }}
          >
            <SidebarMenuItem
              to="/add-regions"
              icon="element-11"
              title="Add Regions"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-regional-head"
              icon="element-11"
              title="Add Regional Head"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-ci-bulk"
              icon="element-11"
              title="Add CI Bulk"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/add-zonal-head"
              icon="element-11"
              title="Add Zonal Head"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-exam-center"
              icon="element-11"
              title="Map Region to RH"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-rh-to-exam-centre"
              icon="element-11"
              title="Map RH to Exam Centre"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/map-zone"
              icon="element-11"
              title="Map Zone To Exam"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-center-bulk"
              icon="element-11"
              title="Exam Center Bulk Upload"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/exam-manuals"
              icon="element-11"
              title="Upload Exam Manuals"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/upload-mock-data"
              icon="element-11"
              title="Upload Mock Data"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/upload-annexure"
              icon="element-11"
              title="Uplaod Annexure"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/annexure-status"
              icon="element-11"
              title="View Annexures & Status"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/view-declaration"
              icon="element-11"
              title="View Declaration"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/view-feedback"
              icon="element-11"
              title="View Feedback"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-details"
              icon="element-11"
              title="My Center Details"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-staff-decelaration"
              icon="element-11"
              title="Centre Staff Decelaration"
              fontIcon="bi-app-indicator"
            />
            {/* <SidebarMenuItem
        to="/centre-wise-city-list"
        icon="element-11"
        title="View Centre Wise CITY List"
        fontIcon="bi-app-indicator"
      /> */}
            <SidebarMenuItem
              to="/center-list-biometric"
              icon="element-11"
              title="Centre List For Biometric"
              fontIcon="bi-app-indicator"
            />
            {/* <SidebarMenuItem
        to="/create-atc-users"
        icon="element-11"
        title="Create ATC Users"
        fontIcon="bi-app-indicator"
      /> */}
            <SidebarMenuItem
              to="/allocationas-status"
              icon="element-11"
              title="Allocations Status Report"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/man-power-list"
              icon="element-11"
              title="Man Power List And Count"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-biometric"
              icon="element-11"
              title="Download Candidate Biometric"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-mock-data"
              icon="element-11"
              title="Download Mock Data"
              fontIcon="bi-app-indicator"
            />
            {/* <SidebarMenuItem
        to="/download-mock-data-slot"
        icon="element-11"
        title="Download Mock Data - SlotWise"
        fontIcon="bi-app-indicator"
      /> */}
            <SidebarMenuItem
              to="/download-exam-manuals"
              icon="element-11"
              title="Download Exam Manuals"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-generate-main-exam-data"
              icon="element-11"
              title="Download Generated Data - Slotwise
"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/enable-feedback"
              icon="element-11"
              title="Enable Feedback"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/center-feedback-form"
              icon="element-11"
              title="Centre / Staff Feedback Form"
              fontIcon="bi-app-indicator"
            />
            <SidebarMenuItem
              to="/download-exam-data"
              icon="element-11"
              title="Generate Exam Data"
              fontIcon="bi-app-indicator"
            />
            {/* Add more items as needed */}
          </div>
        )}
      </div>
    </>
  );
};

export { SidebarMenuMain };
