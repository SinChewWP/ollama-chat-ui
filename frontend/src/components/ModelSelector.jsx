export default function ModelSelector({ models, selectedModel, onChange }) {
  if (models.length === 0) {
    return (
      <span className="text-xs text-red-400 px-3 py-1.5 bg-red-900/40 border border-red-800 rounded-lg">
        No models — is Ollama running?
      </span>
    );
  }

  return (
    <select
      value={selectedModel}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
    >
      {models.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
