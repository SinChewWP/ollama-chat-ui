import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import ModelSelector from './ModelSelector';
import SystemPromptModal from './SystemPromptModal';

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 bg-purple-600 flex items-center justify-center text-xs font-semibold text-white">
        AI
      </div>
      <div className="flex items-center gap-1 mt-2 bg-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
      </div>
    </div>
  );
}

export default function ChatWindow({
  conversation,
  models,
  selectedModel,
  onModelChange,
  streaming,
  streamingContent,
  onSendMessage,
  onUpdateConversation,
  error,
}) {
  const [input, setInput] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when messages change or stream updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, streamingContent]);

  const submit = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    onSendMessage(text);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const growTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const hasMessages = conversation?.messages?.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onChange={onModelChange}
          />
          {conversation && (
            <button
              onClick={() => setShowSystemPrompt(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <span>⚙</span>
              System Prompt
              {conversation.system_prompt && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />
              )}
            </button>
          )}
        </div>
        {conversation && (
          <p className="text-sm text-gray-400 truncate hidden sm:block">{conversation.title}</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!conversation ? (
          /* Welcome screen */
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="text-6xl mb-5">⬡</div>
            <h2 className="text-2xl font-semibold text-gray-200 mb-2">Ollama Chat</h2>
            <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
              Run AI models locally. Select a conversation or click{' '}
              <span className="text-blue-400">New Chat</span> to get started.
            </p>
          </div>
        ) : !hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center">
            <p className="text-gray-600 text-sm">Send a message to start.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
            {conversation.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming reply */}
            {streaming && streamingContent && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingContent }}
                isStreaming
              />
            )}
            {streaming && !streamingContent && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      {conversation && (
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={submit} className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  growTextarea();
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  streaming
                    ? 'Waiting for response…'
                    : 'Message… (Enter to send, Shift+Enter for new line)'
                }
                disabled={streaming}
                rows={1}
                className="flex-1 resize-none bg-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 disabled:opacity-50 overflow-y-auto"
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white flex items-center justify-center transition-colors"
                title="Send"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-600 mt-2 text-center">
              {selectedModel} · conversations stored locally
            </p>
          </div>
        </div>
      )}

      {/* System prompt modal */}
      {showSystemPrompt && conversation && (
        <SystemPromptModal
          systemPrompt={conversation.system_prompt ?? ''}
          onSave={(prompt) => {
            onUpdateConversation(conversation.id, { system_prompt: prompt });
            setShowSystemPrompt(false);
          }}
          onClose={() => setShowSystemPrompt(false)}
        />
      )}
    </div>
  );
}
