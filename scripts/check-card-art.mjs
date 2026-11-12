import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const manifest=JSON.parse(readFileSync("public/assets/cards/manifest.json","utf8"));
const index=JSON.parse(readFileSync("src/lib/card-art-index.json","utf8"));
const errors=[],hashes=new Map();let generated=0;
for(const card of manifest.cards){
  const expected=`/assets/cards/${card.banner}/${card.rarity}/${card.kind}/regular_${card.id}.png`;
  if(card.file!==expected)errors.push(`${card.id}: unexpected path`);
  if(index[card.id]!==card.file)errors.push(`${card.id}: frontend index mismatch`);
  const file=resolve("public",card.file.slice(1));
  if(card.status!=="generated"){errors.push(`${card.id}: pending`);continue}
  if(!existsSync(file)){errors.push(`${card.id}: missing PNG`);continue}
  const bytes=readFileSync(file),hash=createHash("sha256").update(bytes).digest("hex");
  if(hash!==card.sha256)errors.push(`${card.id}: checksum mismatch`);
  if(hashes.has(hash))errors.push(`${card.id}: duplicate image of ${hashes.get(hash)}`);
  hashes.set(hash,card.id);
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))errors.push(`${card.id}: not PNG`);
  if(bytes.readUInt32BE(16)!==card.width||bytes.readUInt32BE(20)!==card.height)errors.push(`${card.id}: dimension mismatch`);
  generated++;
}
if(manifest.cards.length!==150)errors.push(`Expected 150 cards; got ${manifest.cards.length}`);
if(Object.keys(index).length!==manifest.cards.length)errors.push("Frontend index must contain every card exactly once");
console.log(JSON.stringify({total:manifest.cards.length,generated,errors},null,2));
process.exitCode=errors.length?1:0;
