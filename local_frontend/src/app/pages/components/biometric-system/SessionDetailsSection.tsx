import React from "react";
import { Link } from "react-router-dom";

interface SessionDetailsSectionProps {
  totalCandidates: number;
  totalAllotedCandidates: number;
}

const SessionDetailsSection: React.FC<SessionDetailsSectionProps> = ({
  totalCandidates,
  totalAllotedCandidates,
}) => {
  return (
    <div className="cus-card">
      <div className="card-title card-title-color p-2 m-0">
        <h3 className="fw-bolder m-0 text-white text-center">
          Session Details At Centre
          <Link to="/candidate-biometric-list" target="_blank">
            <button className="btn btn-warning view-list-btn mx-3">
              <i className="fa-solid fa-list-check text-white mx-1" style={{ fontSize: "15px" }}></i>
              View List
            </button>
          </Link>
        </h3>
      </div>
      <div className="row">
        <div className="col-lg-12">
          <div className="row session-detail-main cus-card-inner">
            <div className="col-lg-3 mt-1 mx-2 text-center fw-bold text-light session-detail-container bg-sky">
              <div>
                Total Candidates: <span>{totalCandidates}</span>
              </div>
            </div>
            <div className="col-lg-3 mt-1 mx-2 text-center fw-bold text-light session-detail-container bg-green">
              <div>
                Total Biometric Done: <span>{totalAllotedCandidates}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SessionDetailsSection };
