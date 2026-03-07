import React from "react";
import type { CandidateDetails } from "./types";

interface CandidateDetailsSectionProps {
  disabledAll: boolean;
  candidateDetails: CandidateDetails;
  isLoading: boolean;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>
  ) => void;
  onHallTicketKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onResetDetails: () => void;
  onSystemReset: () => void;
  onSubmit: () => void;
}

const CandidateDetailsSection: React.FC<CandidateDetailsSectionProps> = ({
  disabledAll,
  candidateDetails,
  isLoading,
  onInputChange,
  onHallTicketKeyDown,
  onResetDetails,
  onSystemReset,
  onSubmit,
}) => {
  return (
    <>
      <div className="cus-card">
        <div className="card-title card-title-color p-2 m-0">
          <h3 className="fw-bolder m-0 text-white text-center">Candidate Details</h3>
        </div>
        <div className="row">
          <div className="col-lg-12">
            <div className="row candidate-detail-main cus-card-inner">
              <div className="col-lg-8 mt-1 mx-2 fw-bold">
                <input
                  disabled={false}
                  type="text"
                  className="form-control mb-1 custom-candidate-input"
                  name="hallTicket"
                  value={candidateDetails.hallTicket}
                  onChange={onInputChange}
                  onKeyDown={onHallTicketKeyDown}
                  placeholder="Enter Application Number"
                  autoComplete="off"
                />
                <input
                  readOnly
                  type="text"
                  className="form-control mb-1 custom-candidate-input"
                  name="candidateName"
                  value={candidateDetails.candidateName}
                  placeholder="Candidate's Name"
                />
                <input
                  readOnly
                  type="text"
                  className="form-control mb-1 custom-candidate-input"
                  name="emailId"
                  value={candidateDetails.emailId}
                  placeholder="Email Id"
                />

                <select
                  disabled
                  name="gender"
                  value={candidateDetails.gender}
                  className="form-select mb-1 form-select-solid form-select-lg fw-bold custom-candidate-input"
                >
                  <option value="" disabled>
                    -- Please Select Gender --
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="others">Others</option>
                </select>
                <select className="form-select form-select-solid form-select-lg fw-bold custom-candidate-input mb-1">
                  <optgroup label="Right Hand">
                    <option value="right-thumb">Right Thumb</option>
                    <option value="right-index">Right Index Finger</option>
                    <option value="right-middle">Right Middle Finger</option>
                    <option value="right-ring">Right Ring Finger</option>
                    <option value="right-pinky">Right Pinky Finger</option>
                  </optgroup>
                  <optgroup label="Left Hand">
                    <option value="left-thumb">Left Thumb</option>
                    <option value="left-index">Left Index Finger</option>
                    <option value="left-middle">Left Middle Finger</option>
                    <option value="left-ring">Left Ring Finger</option>
                    <option value="left-pinky">Left Pinky Finger</option>
                  </optgroup>
                </select>
              </div>
              <div className="col-lg-3 mt-1 mx-2 fw-bold displey-flex-center">
                <button className="btn btn-success text-white text-center cus-candidate-btn mb-2" onClick={onResetDetails}>
                  <div className="candi-btn-inner">
                    <i className="fa-solid fa-user-plus text-white mx-1"></i>
                    New Candidate
                  </div>
                </button>
                <button
                  className="btn bg-gray text-white cus-candidate-btn"
                  onClick={onSystemReset}
                  title="Reset entire system and delete all data"
                >
                  <div className="candi-btn-inner text-center">
                    <i className="fa fa-refresh text-white mx-2"></i>
                    Reset System
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cus-card mt-0">
        <div className="row flex-center">
          <div className="col-lg-5 mt-2 displey-flex-center">
            <button className="btn btn-primary final-main-btn" onClick={onSubmit} disabled={!candidateDetails.hallTicket || isLoading}>
              {isLoading ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              {isLoading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export { CandidateDetailsSection };
