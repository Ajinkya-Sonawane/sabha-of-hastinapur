export type GameId = string & { readonly __brand: "GameId" };
export type PlayerId = string & { readonly __brand: "PlayerId" };
export type CardId = string & { readonly __brand: "CardId" };
export type EventId = string & { readonly __brand: "EventId" };

export const asGameId = (value: string) => value as GameId;
export const asPlayerId = (value: string) => value as PlayerId;
export const asCardId = (value: string) => value as CardId;
export const asEventId = (value: string) => value as EventId;
