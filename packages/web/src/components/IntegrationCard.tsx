import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface IntegrationCardProps {
  integrationId: string;
  name: string;
  icon: React.ReactNode;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading?: boolean;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  name,
  icon,
  isConnected,
  onConnect,
  onDisconnect,
  isLoading = false,
}) => {
  return (
    <Card className="p-6 bg-[#111] border-[#1a1a1a] hover:border-blue-400/50 transition-colors flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl flex-shrink-0">{icon}</div>
          <div>
            <h3 className="font-bold text-white">{name}</h3>
          </div>
        </div>
      </div>

      <Badge variant={isConnected ? "default" : "secondary"}>
        {isConnected ? "Connected" : "Not connected"}
      </Badge>

      <Button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isLoading}
        variant={isConnected ? "outline" : "default"}
        className="w-full"
      >
        {isLoading ? "Loading..." : isConnected ? "Disconnect" : "Connect"}
      </Button>
    </Card>
  );
};

export default IntegrationCard;
