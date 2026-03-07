import React from "react";
import type { CenterValues } from "./types";

interface ExaminationDetailsSectionProps {
  centerValues: CenterValues;
}

const ExaminationDetailsSection: React.FC<ExaminationDetailsSectionProps> = ({
  centerValues,
}) => {
  return (
    <div className="cus-card">
      <div className="card-title card-title-color p-2 m-0">
        <h3 className="fw-bolder m-0 text-white text-center">Examination Details</h3>
      </div>
      <div className="row">
        <div className="col-lg-12">
          <div className="row cus-card-inner">
            <div className="col-lg-6 mt-1 text-center">
              <label className="required fw-bold">- Centre Code -</label>
              <input
                readOnly
                type="text"
                className="form-control mb-1 mb-lg-0 custom-input-field"
                name="centreCode"
                placeholder="Centre Code"
                value={centerValues.centreCode}
                autoComplete="off"
              />
            </div>
            <div className="col-lg-6 mt-1 text-center">
              <label className="required fw-bold">- Centre Name -</label>
              <input
                readOnly
                type="text"
                className="form-control mb-1 mb-lg-0 custom-input-field"
                name="centreName"
                placeholder="Centre Name"
                value={centerValues.centreName}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ExaminationDetailsSection };
