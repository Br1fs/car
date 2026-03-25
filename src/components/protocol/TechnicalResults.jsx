export default function TechnicalResults({ template, setTemplate }) {

  const handleChange = (index, field, value) => {
    const updated = [...template.technicalResults];
    updated[index][field] = value;
    setTemplate(prev => ({ ...prev, technicalResults: updated }));
  };

  return (
    <>
      <div className="section-title">
        РЕЗУЛЬТАТЫ ТЕХНИЧЕСКОЙ ЭКСПЕРТИЗЫ И ИСПЫТАНИЙ
      </div>

      <div className="table">
        <div className="table-row">
          <div className="table-cell" style={{ width: "15%" }}>Параметр</div>
          <div className="table-cell" style={{ width: "15%" }}>Метод</div>
          <div className="table-cell" style={{ width: "40%" }}>Значение по НД</div>
          <div className="table-cell" style={{ width: "30%" }}>Фактические</div>
        </div>

        {template.technicalResults.map((row, idx) => (
          <div key={idx} className="table-row">
            <div className="table-cell" style={{ width: "15%" }}>
              <textarea
                value={row.parameter}
                onChange={e => handleChange(idx, "parameter", e.target.value)}
              />
            </div>
            <div className="table-cell" style={{ width: "15%" }}>
              <textarea
                value={row.method}
                onChange={e => handleChange(idx, "method", e.target.value)}
              />
            </div>
            <div className="table-cell" style={{ width: "40%" }}>
              <textarea
                value={row.normValue}
                onChange={e => handleChange(idx, "normValue", e.target.value)}
              />
            </div>
            <div className="table-cell" style={{ width: "30%" }}>
              <textarea
                value={row.actualValue}
                onChange={e => handleChange(idx, "actualValue", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}