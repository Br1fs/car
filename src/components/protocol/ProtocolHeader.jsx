import logo from "../../assets/logo.png";

export default function ProtocolHeader({ template }) {
  return (
    <div className="protocol-header-fixed">

      <div className="header-cell logo-cell">
        <img src={logo} alt="logo" />
      </div>

      <div className="header-cell">
        <textarea
          value={template.countryText}
          readOnly
        />
      </div>

      <div className="header-cell">
        <textarea
          value={template.accreditationText}
          readOnly
        />
      </div>

    </div>
  );
}