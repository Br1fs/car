export default function ProtocolTemplateEditor({ value, onChange }) {
  const updateTitle = (index, title) => {
    const sections = [...value.sections];
    sections[index].title = title;
    onChange({ ...value, sections });
  };

  return (
    <div className="space-y-4">
      {value.sections.map((section, index) => (
        <div key={section.id} className="border p-4 rounded">
          <input
            className="border p-2 w-full mb-2 font-semibold"
            value={section.title}
            onChange={e => updateTitle(index, e.target.value)}
          />

          <table className="w-full border">
            <tbody>
              {section.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="border p-2 w-1/2">{row.label}</td>
                  <td className="border p-2 text-gray-500">
                    {`{{${row.key}}}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
