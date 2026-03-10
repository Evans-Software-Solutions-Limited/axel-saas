import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconSend } from "@tabler/icons-react";

interface Message {
  id: string;
  sender: "user" | "axel";
  content: string;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: "1",
    sender: "axel",
    content: "Hi! I'm Axel, your AI employee. How can I help you today?",
    timestamp: new Date(Date.now() - 3600000),
  },
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      setMessages([
        ...messages,
        {
          id: Date.now().toString(),
          sender: "user",
          content: input,
          timestamp: new Date(),
        },
      ]);
      setInput("");

      // Simulate Axel response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "axel",
            content: "I'm processing your request...",
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.sender === "user"
                  ? "bg-accent text-white rounded-br-none"
                  : "bg-surface-raised text-text rounded-bl-none"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tell Axel what to do..."
          className="bg-surface-raised border-border text-text"
        />
        <Button
          onClick={handleSend}
          className="bg-accent hover:bg-accent/90 text-white px-4"
        >
          <IconSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
