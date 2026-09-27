import type { RoleId } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { ARJUNA } from "./arjuna";
import { ASHWATTHAMA } from "./ashwatthama";
import { BHIMA } from "./bhima";
import { BHISHMA } from "./bhishma";
import { DRAUPADI } from "./draupadi";
import { DRONA } from "./drona";
import { DURYODHANA } from "./duryodhana";
import { DUSHASANA } from "./dushasana";
import { GANDHARI } from "./gandhari";
import { KARNA } from "./karna";
import { KRISHNA } from "./krishna";
import { NAKULA } from "./nakula";
import { SAHADEVA } from "./sahadeva";
import { SANJAYA } from "./sanjaya";
import { SHAKUNI } from "./shakuni";
import { SHIKHANDI } from "./shikhandi";
import { VIDURA } from "./vidura";
import { YUDHISHTHIRA } from "./yudhishthira";

export const ROLE_REGISTRY: Record<RoleId, RoleDefinition> = {
  DURYODHANA,
  SHAKUNI,
  DUSHASANA,
  ASHWATTHAMA,
  YUDHISHTHIRA,
  BHIMA,
  ARJUNA,
  NAKULA,
  SAHADEVA,
  DRAUPADI,
  KRISHNA,
  VIDURA,
  KARNA,
  BHISHMA,
  DRONA,
  SANJAYA,
  SHIKHANDI,
  GANDHARI,
};

export function getRole(id: RoleId): RoleDefinition {
  const role = ROLE_REGISTRY[id];
  if (!role) throw new Error(`Unknown role ${id}`);
  return role;
}
