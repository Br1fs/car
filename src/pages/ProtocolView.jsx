import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_URL } from "../config";

export default function ProtocolView() {
  const { id } = useParams();
  const [protocol, setProtocol] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/protocols/${id}`)
      .then(res => {
        const data = res.data;

        if (data.protocolDate) {
          data.protocolDate = data.protocolDate.split("T")[0];
        }

        setProtocol(data);
      })
      .catch(err => {
        console.error(err);
        alert("Протокол не найден");
      });
  }, [id]);

  if (!protocol) return <div>Загрузка...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Протокол № {protocol.protocolNumber}</h2>

      {/* ✅ Новый правильный маршрут */}
      <button
        onClick={() =>
          window.open(`${API_URL}/api/protocols/${id}/pdf-template`, "_blank")
          
        }
      >
        Скачать PDF (шаблон)
      </button>

      <pre>{JSON.stringify(protocol, null, 2)}</pre>
    </div>
  );
}