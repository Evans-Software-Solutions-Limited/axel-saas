import { useState, useRef, useEffect } from "react";
import { IconSend } from "@tabler/icons-react";

interface Message {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "1",
      text: "Hi! I'm Axel, your AI assistant. How can I help you today?",
      role: "assistant",
      timestamp: new Date(Date.now() - 5000),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I received your message. How else can I assist you?",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] bg-[#12141f] flex flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex gap-3 max-w-md ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 font-bold text-sm">⚡</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-[#252840] text-[#e8e9f0] rounded-tl-sm"
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs text-[#8b8fa8] mt-1 opacity-75">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-300 font-bold text-sm">⚡</span>
              </div>
              <div className="bg-[#252840] rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#8b8fa8] animate-bounce" />
                  <div
                    className="w-2 h-2 rounded-full bg-[#8b8fa8] animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-[#8b8fa8] animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="bg-[#1e2130] border-t border-[#2a2d3e] p-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 bg-[#252840] text-white rounded-lg px-4 py-3 text-sm placeholder-[#8b8fa8] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-ring duration-150"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600 disabled:bg-indigo-500/50 transition-colors duration-150 flex-shrink-0"
          >
            <IconSend size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
