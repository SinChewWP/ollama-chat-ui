import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  fetchModels,
  sendMessage,
  updateConversation,
} from './api';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModels();
    loadConversations();
  }, []);

  const loadModels = async () => {
    try {
      const data = await fetchModels();
      const list = data.models ?? [];
      setModels(list);
      if (list.length > 0) setSelectedModel((prev) => prev || list[0].name);
    } catch {
      setError('Cannot connect to Ollama. Make sure it is running on port 11434.');
    }
  };

  const loadConversations = async () => {
    try {
      setConversations(await fetchConversations());
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  const selectConversation = useCallback(async (id) => {
    setActiveConvId(id);
    try {
      const conv = await fetchConversation(id);
      setActiveConv(conv);
      setSelectedModel((prev) => conv.model || prev);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  }, []);

  const newConversation = async () => {
    try {
      const conv = await createConversation({
        title: 'New Chat',
        model: selectedModel,
        system_prompt: '',
      });
      setConversations((prev) => [conv, ...prev]);
      await selectConversation(conv.id);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setActiveConv(null);
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const handleUpdateConversation = async (id, data) => {
    try {
      const updated = await updateConversation(id, data);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      if (activeConvId === id) setActiveConv((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      console.error('Failed to update conversation:', e);
    }
  };

  const handleSendMessage = async (content) => {
    if (!activeConvId || streaming) return;
    setError(null);

    // Optimistic user bubble
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setActiveConv((prev) => ({ ...prev, messages: [...(prev?.messages ?? []), tempUserMsg] }));

    setStreaming(true);
    setStreamingContent('');

    try {
      for await (const event of sendMessage(activeConvId, content, selectedModel)) {
        if (event.error) throw new Error(event.error);
        if (event.token) setStreamingContent((prev) => prev + event.token);
        if (event.done) {
          // Replace optimistic state with persisted data
          const updated = await fetchConversation(activeConvId);
          setActiveConv(updated);
          // Refresh list to update title + sort order
          setConversations(await fetchConversations());
        }
      }
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setStreaming(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={handleDeleteConversation}
      />
      <ChatWindow
        conversation={activeConv}
        models={models}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        streaming={streaming}
        streamingContent={streamingContent}
        onSendMessage={handleSendMessage}
        onUpdateConversation={handleUpdateConversation}
        error={error}
      />
    </div>
  );
}
