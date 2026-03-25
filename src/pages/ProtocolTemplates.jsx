import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ProtocolTemplates() {
  const [list, setList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/protocol-templates")
      .then((res) => setList(res.data))
      .catch((err) => console.error(err));
  }, []);

  const remove = async (id) => {
    if (!window.confirm("Удалить шаблон?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/protocol-templates/${id}`);
      setList((prev) => prev.filter((x) => x._id !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка удаления шаблона");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Шаблоны протоколов</h2>

      <button onClick={() => navigate("/protocol-templates/create")}>
        + Добавить шаблон
      </button>

      <div style={{ marginTop: 20 }}>
        {list.length === 0 ? (
          <div>Шаблоны пока не добавлены</div>
        ) : (
          list.map((t) => (
            <div
              key={t._id}
              style={{
                border: "1px solid #ccc",
                padding: 10,
                marginBottom: 10,
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <div>
                <b>Категория:</b> {t.category || "-"}
              </div>

              <div>
                <b>Топливо:</b> {t.fuelType || "Электро"}
              </div>

              <div>
                <b>PDF файл:</b> {t.pdfTemplate || "-"}
              </div>

              <div>
                <b>Номер:</b> {t.protocolNumber || "-"}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  onClick={() => navigate(`/protocol-templates/${t._id}/edit`)}
                >
                  Редактировать
                </button>

                <button onClick={() => remove(t._id)}>Удалить</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}