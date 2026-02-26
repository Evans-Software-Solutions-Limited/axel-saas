import React from "react";

interface AxelLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "text" | "icon";
}

const AxelLogo: React.FC<AxelLogoProps> = ({
  size = "md",
  variant = "text",
}) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const fontSize = sizeMap[size];

  if (variant === "icon") {
    return <span style={{ fontSize }}>{/* ⚡ */}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-${size === "sm" ? "lg" : size === "md" ? "xl" : "2xl"}`}
      >
        ⚡
      </span>
      <span
        className={`font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent ${
          size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-2xl"
        }`}
      >
        Axel
      </span>
    </div>
  );
};

export default AxelLogo;
