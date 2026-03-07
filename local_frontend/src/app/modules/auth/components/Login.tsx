import { useRef, useState } from "react";
import * as Yup from "yup";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import { getUserByToken, login } from "../core/_requests";
import { toAbsoluteUrl } from "../../../../_metronic/helpers";
import { useAuth } from "../core/Auth";
import { AuthModel, UserModel } from "../core/_models";
import { loginUser } from "../../../services/AuthService";

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email("Wrong email format")
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Email is required"),
  password: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Password is required"),
});

const initialValues = {
  email: "",
  password: "",
};

/*
  Formik+YUP+Typescript:
  https://jaredpalmer.com/formik/docs/tutorial#getfieldprops
  https://medium.com/@maurice.de.beijer/yup-validation-and-typescript-and-formik-6c342578a20e
*/

export function Login() {
  const [loading, setLoading] = useState(false);
  const { saveAuth, setCurrentUser } = useAuth();
    const passwordRef = useRef<HTMLInputElement>(null);

  const formik = useFormik({
    initialValues,
    validationSchema: loginSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        const { data } = await loginUser(values.email, values.password);
        
        if (data.successful) {
          const auth: AuthModel = {
            api_token: data.data.api_token,
            refreshToken: undefined,
            data: undefined
          };

          // Cloud backend returns 'name' field, not 'username'
          const userName = data.data.user.name || data.data.user.email;
          const userEmail = data.data.user.email;
          
          const user: UserModel = {
            id: data.data.user.id,
            username: userEmail,
            email: userEmail,
            first_name: userName.split(" ")[0] || userEmail.split("@")[0],
            last_name: userName.split(" ").slice(1).join(" ") || "",
            roles: [data.data.user.role],
            fullname: userName,
            password: undefined
          };

          // Store centreCode and centreName in localStorage for Examination Details
          if (data.data.user.centreCode) {
            localStorage.setItem("centreCode", data.data.user.centreCode);
          }
          if (data.data.user.centreName) {
            localStorage.setItem("centreName", data.data.user.centreName);
          }

          console.log('🔐 Login successful, saving auth and user:', { auth, user });
          
          localStorage.setItem("authToken", auth.api_token);
          saveAuth(auth);
          setCurrentUser(user);
          
          console.log('✅ Auth saved to localStorage');
          console.log('📦 localStorage contents:', {
            authToken: localStorage.getItem('authToken'),
            ktAuthKey: localStorage.getItem('kt-auth-react-v'),
            currentUser: localStorage.getItem('currentUser'),
            centreCode: localStorage.getItem('centreCode'),
            centreName: localStorage.getItem('centreName')
          });
          
          // Small delay to ensure state is saved
          setTimeout(() => {
            console.log('🚀 Redirecting to /biometric-system...');
            window.location.href = '/biometric-system';
          }, 100);
        } else {
          throw new Error(data.message || "Login failed");
        }
      } catch (error) {
        console.error(error);
        saveAuth(undefined);
        setStatus("The login details are incorrect");
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  return (
    <form
      className="form w-100"
      onSubmit={formik.handleSubmit}
      noValidate
      id="kt_login_signin_form"
    >
      <div className="text-center mb-5">
        <img
          src={toAbsoluteUrl("media/logos/digi-logo-full.webp")}
          alt=""
          style={{ width: "110px" }}
        />
      </div>
      <div className="text-center mb-11">
        <h1 className="text-gray-900 fw-bolder mb-3">
          Biometric System CI Login
        </h1>
      </div>
      <div className="fv-row mb-8">
        <label className="form-label fs-6 fw-bolder text-gray-900">Email</label>
        <input
          placeholder="Email"
          {...formik.getFieldProps("email")}
          className={clsx(
            "form-control bg-transparent",
            { "is-invalid": formik.touched.email && formik.errors.email },
            {
              "is-valid": formik.touched.email && !formik.errors.email,
            }
          )}
          type="email"
          name="email"
          autoComplete="off"
        />
        {formik.touched.email && formik.errors.email && (
          <div className="fv-plugins-message-container">
            <span role="alert">{formik.errors.email}</span>
          </div>
        )}
      </div>
      <div className="fv-row mb-3">
        <label className="form-label fw-bolder text-gray-900 fs-6 mb-0">
          Password
        </label>
        <input
         placeholder="Password"
          type="password"
          autoComplete="off"
           ref={passwordRef}
            onBlur={formik.handleBlur}
            onChange={() => {
              if (passwordRef.current) {
                formik.setFieldValue("password", passwordRef.current.value);
              }
            }}
          className={clsx(
            "form-control bg-transparent",
            {
              "is-invalid": formik.touched.password && formik.errors.password && !passwordRef.current?.value,
            },
            {
              "is-valid": formik.touched.password && !formik.errors.password && passwordRef.current?.value,
            }
          )}
        />
        {formik.touched.password && formik.errors.password && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.password}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Wrapper */}
      {/* <div className="d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold mb-8"> */}
      {/* <div /> */}

      {/* begin::Link */}
      {/* <Link to="/auth/forgot-password" className="link-primary"> */}
      {/* Forgot Password ? */}
      {/* </Link> */}
      {/* end::Link */}
      {/* </div> */}
      {/* end::Wrapper */}

      {/* begin::Action */}
      <div className="d-grid mb-10">
        <button
          type="submit"
          id="kt_sign_in_submit"
          className="btn btn-primary"
          disabled={formik.isSubmitting || !formik.isValid}
        >
          {!loading && <span className="indicator-label">Login</span>}
          {loading && (
            <span className="indicator-progress" style={{ display: "block" }}>
              Please wait...
              <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
            </span>
          )}
        </button>
        {/* <button
          type='submit'
          id='kt_sign_in_submit'
          className='btn btn-primary'
          disabled={formik.isSubmitting || !formik.isValid}
        >
          {!loading && <span className='indicator-label'>Continue</span>}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              Please wait...
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button> */}
        {formik.status && (
          <div className="alert alert-danger text-center mt-4" role="alert">
            {formik.status}
          </div>
        )}

      </div>
      {/* end::Action */}

      {/* <div className='text-gray-500 text-center fw-semibold fs-6'>
        Not a Member yet?{' '}
        <Link to='/auth/registration' className='link-primary'>
          Sign up
        </Link>
      </div> */}
    </form>
  );
}
