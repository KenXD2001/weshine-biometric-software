import React from "react";

interface ApplicationLogsSectionProps {
  applicationLog: string;
}

const ApplicationLogsSection: React.FC<ApplicationLogsSectionProps> = ({ applicationLog }) => {
  return (
    <div className="cus-card">
      <div className="card-title card-title-color p-2 m-0">
        <h3 className="fw-bolder m-0 text-white text-center">Application Logs</h3>
      </div>
      <div className="row app-log-container">
        <div className="col-lg-11  form-control app-log-window">{applicationLog}</div>
      </div>
    </div>
  );
};

export { ApplicationLogsSection };
