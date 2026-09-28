import type { Metadata } from "next";
import { GameClient } from "@/components/GameClient";

export const metadata: Metadata = { title: "Sabha of Hastinapur" };

export default async function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <GameClient roomCode={roomCode.toUpperCase()} />;
}
