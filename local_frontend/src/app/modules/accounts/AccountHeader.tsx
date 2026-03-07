import { FC } from "react";
import { KTIcon, toAbsoluteUrl } from "../../../_metronic/helpers";
// import { Content } from "../../_metronic/layout/components/content";
import { Content } from "../../../_metronic/layout/components/content";


const AccountHeader: FC = () => {
  return (
    <>
      <Content>
        <div className="card mb-5 mb-xl-10">
          <div className="card-body pt-9 pb-0">
            <div className="d-flex flex-wrap flex-sm-nowrap mb-3">
              <div className="me-7 mb-4">
                <div className="symbol symbol-100px symbol-lg-160px symbol-fixed position-relative">
                  <img src={toAbsoluteUrl("media/shubham.jpg")} alt="shubham" />
                  <div className="position-absolute translate-middle bottom-0 start-100 mb-6 bg-success rounded-circle border border-4 border-white h-20px w-20px"></div>
                </div>
              </div>

              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-start flex-wrap mb-2">
                  <div className="d-flex flex-column">
                    <div className="d-flex align-items-center mb-2">
                      <a
                        href="#"
                        className="text-gray-800 text-hover-primary fs-2 fw-bolder me-1"
                      >
                        SHUBHAM KUMAR
                      </a>
                    </div>

                    <div className="d-flex flex-wrap fw-bold fs-6 mb-4 pe-2">
                      <a
                        href="#"
                        className="d-flex align-items-center text-gray-500 text-hover-primary me-5 mb-2"
                      >
                        <KTIcon
                          iconName="profile-circle"
                          className="fs-4 me-1"
                        />
                        Registration No:- 784687684768276
                      </a>

                      <a
                        href="#"
                        className="d-flex align-items-center text-gray-500 text-hover-primary mb-2"
                      >
                        <KTIcon iconName="sms" className="fs-4 me-1" />
                        SHUBHAM.DEVBR@GMAIL.COM
                      </a>
                    </div>
                  </div>
                </div>
                <div
                  className="card mb-5 mb-xl-10"
                  id="kt_profile_details_view"
                >
                  <div className="card-header cursor-pointer">
                    <div className="card-title m-0">
                      <h3 className="fw-bolder m-0">Profile Details</h3>
                    </div>
                  </div>

                  <div className="card-body p-9">
                    <div className="row mb-7">
                      <label className="col-lg-4 fw-bold text-muted">
                        Full Name
                      </label>

                      <div className="col-lg-8">
                        <span className="fw-bolder fs-6 text-gray-900">
                          SHUBHAM KUMAR
                        </span>
                      </div>
                    </div>

                    <div className="row mb-7">
                      <label className="col-lg-4 fw-bold text-muted">
                        Contact Phone
                        <i
                          className="fas fa-exclamation-circle ms-1 fs-7"
                          data-bs-toggle="tooltip"
                          title="Phone number must be active"
                        ></i>
                      </label>

                      <div className="col-lg-8 d-flex align-items-center">
                        <span className="fw-bolder fs-6 me-2">
                          +91 9771394656
                        </span>

                        <span className="badge badge-success">Verified</span>
                      </div>
                    </div>

                    <div className="row mb-7">
                      <label className="col-lg-4 fw-bold text-muted">
                        Country
                        <i
                          className="fas fa-exclamation-circle ms-1 fs-7"
                          data-bs-toggle="tooltip"
                          title="Country of origination"
                        ></i>
                      </label>

                      <div className="col-lg-8">
                        <span className="fw-bolder fs-6 text-gray-900">
                          India
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </Content>
    </>
  );
};

export { AccountHeader };
