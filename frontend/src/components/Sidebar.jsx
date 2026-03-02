import { useState } from 'react';

function relativeDate(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 86_400_000) return 'Today';
  if (diff < 172_800_000) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString();
}

export default function Sidebar({ conversations, activeConvId, onSelect, onNew, onDelete }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="w-64 flex-shrink-0 bg-gray-800 flex flex-col border-r border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blue-400 text-xl">⬡</span>
          <h1 className="text-base font-semibold text-white">Ollama Chat</h1>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-10 px-4">
            No conversations yet.
            <br />
            Start a new chat!
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative mx-2 mb-0.5 rounded-lg cursor-pointer transition-colors ${
                activeConvId === conv.id ? 'bg-gray-600' : 'hover:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(conv.id)}
            >
              <div className="px-3 py-2.5 pr-8">
                <p className="text-sm text-gray-200 truncate">{conv.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{relativeDate(conv.updated_at)}</p>
              </div>
              {(hoveredId === conv.id || activeConvId === conv.id) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                  title="Delete conversation"
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
