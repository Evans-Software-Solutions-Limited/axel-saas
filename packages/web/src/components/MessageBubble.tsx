import React from "react";

interface MessageBubbleProps {
  variant: "user" | "assistant";
  text: string;
  timestamp: Date;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  variant,
  text,
  timestamp,
}) => {
  const timeString = timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (variant === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-xs break-words">
            {text}
          </div>
          <span className="text-xs text-gray-500">{timeString}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        ⚡
      </div>
      <div className="flex flex-col gap-1">
        <div className="bg-[#1a1a1a] text-foreground rounded-2xl rounded-tl-sm px-4 py-2 max-w-xs break-words">
          {text}
        </div>
        <span className="text-xs text-gray-500">{timeString}</span>
      </div>
    </div>
  );
};

export default MessageBubble;
