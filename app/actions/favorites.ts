"use server";

import { auth, signIn, signOut } from "@/auth";
import {
  addFavoriteRecord,
  removeFavoriteRecord,
  type FavoriteKind,
} from "@/lib/favorites";
import { revalidatePath } from "next/cache";

export async function signInWithGoogle() {
  await signIn("google");
}

export async function signOutNow() {
  await signOut();
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    throw new Error("Inicia sessão para gerir favoritos");
  }
  return id;
}

export async function addFavorite(input: {
  kind: FavoriteKind;
  symbol: string;
  name: string;
  extra?: {
    league?: string;
    logo?: string;
    exchange?: string;
    currency?: string;
  };
}) {
  const userId = await requireUserId();
  const session = await auth();
  if (session?.user?.email) {
    const { upsertUser } = await import("@/lib/users");
    await upsertUser(userId, session.user.email).catch(() => undefined);
  }
  await addFavoriteRecord(userId, input);
  revalidatePath("/");
  revalidatePath("/mercado");
}

export async function removeFavorite(kind: FavoriteKind, symbol: string) {
  const userId = await requireUserId();
  await removeFavoriteRecord(userId, kind, symbol);
  revalidatePath("/");
  revalidatePath("/mercado");
}
