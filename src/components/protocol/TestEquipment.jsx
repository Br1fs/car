export default function TestEquipment({ template, setTemplate }) {

  const handleChange = (index, field, value) => {
    const updated = [...template.testEquipment];
    updated[index][field] = value;
    setTemplate(prev => ({ ...prev, testEquipment: updated }));
  };

  return (
    <>
      <div className="section-title">ПЕРЕЧЕНЬ СРЕДСТВ ИСПЫТАНИЙ И ИЗМЕРЕНИЙ</div>

      <div className="table">
        <div className="table-row">
          <div className="table-cell" style={{ width: "10%" }}>№ п/п</div>
          <div className="table-cell" style={{ width: "50%" }}>
            Наименование средств испытаний и измерений
          </div>
          <div className="table-cell" style={{ width: "40%" }}>
            Срок действия сертификата
          </div>
        </div>

        {template.testEquipment.map((item, idx) => (
          <div key={idx} className="table-row">
            <div className="table-cell" style={{ width: "10%" }}>
              {item.number}
            </div>
            <div className="table-cell" style={{ width: "50%" }}>
              <input
                value={item.name}
                onChange={e => handleChange(idx, "name", e.target.value)}
              />
            </div>
            <div className="table-cell" style={{ width: "40%" }}>
              <input
                value={item.certificate}
                onChange={e => handleChange(idx, "certificate", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}