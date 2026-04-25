import { STATUSES } from "../utils/statusService";

export default function StatusSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange}>
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}