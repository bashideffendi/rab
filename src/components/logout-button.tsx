import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-danger"
      >
        Logout
      </button>
    </form>
  );
}
