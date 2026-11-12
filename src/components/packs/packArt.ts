import { ARTWORK } from "@/lib/artwork";
import type { PackId } from "@/game/packs";

/** Edition illustrations only: packaging and card frames are intentionally deferred. */
export const PACK_ART: Record<PackId, string> = ARTWORK.editions;
