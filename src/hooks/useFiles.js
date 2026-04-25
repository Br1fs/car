import { useState } from "react";

export function useFiles() {
  const [files, setFiles] = useState({});
  const [uploaded, setUploaded] = useState([]);

  const handleFileChange = (e, key) => {
    const selected = Array.from(e.target.files || []);

    setFiles(prev => ({
      ...prev,
      [key]: selected
    }));

    setUploaded(prev => [
      ...prev,
      ...selected.map(f => ({
        key,
        name: f.name
      }))
    ]);
  };

  return {
    files,
    uploaded,
    handleFileChange
  };
}