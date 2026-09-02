import { auth } from "@/auth";
import { signInWithGoogle, signOutNow } from "@/app/actions/favorites";

export async function AuthBar() {
  const session = await auth();
  const googleReady = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  if (!googleReady) {
    return (
      <p className="max-w-[11rem] text-right text-[11px] leading-4 text-emerald-200/80">
        Login Google: falta AUTH_GOOGLE_ID no .env
      </p>
    );
  }

  if (!session?.user) {
    return (
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="rounded-full border border-lime-300/40 bg-emerald-900 px-3 py-1 text-xs text-lime-200 hover:bg-emerald-800"
        >
          Entrar com Google
        </button>
      </form>
    );
  }

  return (
    <form action={signOutNow} className="flex items-center gap-2">
      <span className="hidden max-w-[9rem] truncate text-xs text-emerald-200/80 sm:inline">
        {session.user.email || session.user.name}
      </span>
      <button
        type="submit"
        className="rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-100 hover:border-lime-300/50"
      >
        Sair
      </button>
    </form>
  );
}
