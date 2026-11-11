import { z } from "zod";
import { PlayerSchema } from "@/features/types/auth.types";

/** Collection/table name for players. */
export const PLAYERS_COLLECTION = "players";

/** Stored player identity: wallet-only accounts; username is the display name. */
export const PlayerDocumentSchema = PlayerSchema;
export type PlayerDocument = z.infer<typeof PlayerDocumentSchema>;
