export default function IdentificationTable({ template, setTemplate }) {

  const handleChange = (index, field, value) => {
    const updated = [...template.identificationResults];
    updated[index][field] = value;
    setTemplate(prev => ({ ...prev, identificationResults: updated }));
  };

  return (
    <>
      <div className="section-title">РЕЗУЛЬТАТЫ ИДЕНТИФИКАЦИИ</div>

      <div className="table">
        {template.identificationResults.map((item, idx) => (
          <div key={idx} className="table-row">
            <div className="table-cell" style={{ width: "50%" }}>
              <input
                value={item.label}
                onChange={e => handleChange(idx, "label", e.target.value)}
              />
            </div>
            <div className="table-cell" style={{ width: "50%" }}>
              <input
                value={item.value}
                onChange={e => handleChange(idx, "value", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}