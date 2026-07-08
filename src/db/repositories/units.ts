import { and, eq, isNull } from 'drizzle-orm';

import type { CustomKitchenUnit } from '@/domain/units';

import { newId } from '../id';
import { householdCustomUnits } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';
import { assertInRange } from '../validation';

export type CustomKitchenUnitInput = {
  name: string;
  unitType: 'volume' | 'weight';
  conversionValue: number;
  aliases: string[];
};

export async function listCustomKitchenUnits(db: AppDb, householdId: string): Promise<CustomKitchenUnit[]> {
  const rows = await db
    .select()
    .from(householdCustomUnits)
    .where(and(eq(householdCustomUnits.householdId, householdId), isNull(householdCustomUnits.deletedAt)));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    unitType: row.unitType,
    conversionValue: row.conversionValue,
    aliases: row.aliasesJson ? (JSON.parse(row.aliasesJson) as string[]) : [],
  }));
}

export async function createCustomKitchenUnit(
  db: AppDb,
  householdId: string,
  input: CustomKitchenUnitInput,
): Promise<string> {
  assertInRange(input.conversionValue, 0.001, 100000, 'conversionValue');
  const id = newId();
  const now = nowIso();
  await db.insert(householdCustomUnits).values({
    id,
    createdAt: now,
    updatedAt: now,
    householdId,
    name: input.name,
    unitType: input.unitType,
    conversionValue: input.conversionValue,
    aliasesJson: input.aliases.length > 0 ? JSON.stringify(input.aliases) : null,
  });
  return id;
}

export async function updateCustomKitchenUnit(
  db: AppDb,
  unitId: string,
  input: CustomKitchenUnitInput,
): Promise<void> {
  assertInRange(input.conversionValue, 0.001, 100000, 'conversionValue');
  await db
    .update(householdCustomUnits)
    .set({
      name: input.name,
      unitType: input.unitType,
      conversionValue: input.conversionValue,
      aliasesJson: input.aliases.length > 0 ? JSON.stringify(input.aliases) : null,
      updatedAt: nowIso(),
    })
    .where(eq(householdCustomUnits.id, unitId));
}

export async function deleteCustomKitchenUnit(db: AppDb, unitId: string): Promise<void> {
  const now = nowIso();
  await db
    .update(householdCustomUnits)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(householdCustomUnits.id, unitId));
}
