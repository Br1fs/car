import { useNavigate } from "react-router-dom";
import { getApplicationForCopy } from "../utils/copyApplication";

export default function CopyButton({ id }) {
  const navigate = useNavigate();

  const handleCopy = async () => {
    try {
      const data = await getApplicationForCopy(id);

      navigate("/applications/new", {
        state: { copiedData: data },
      });
    } catch (e) {
      alert("Ошибка копирования");
    }
  };

  return <button onClick={handleCopy}>Копировать</button>;
}