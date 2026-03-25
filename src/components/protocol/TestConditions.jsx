export default function TestConditions({ template, setTemplate }) {

  const handleChange = (index, value) => {
    const updated = [...template.testConditions];
    updated[index].value = value;
    setTemplate(prev => ({ ...prev, testConditions: updated }));
  };

  return (
    <>
      <div className="section-title">УСЛОВИЯ ПРОВЕДЕНИЯ ИСПЫТАНИЙ</div>

      <div className="table">
        {template.testConditions.map((item, idx) => (
          <div key={idx} className="table-row">
            <div className="table-cell" style={{ width: "50%" }}>
              {item.label}
            </div>
            <div className="table-cell" style={{ width: "50%" }}>
              <input
                value={item.value}
                onChange={e => handleChange(idx, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}