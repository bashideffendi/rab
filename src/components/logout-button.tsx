import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-danger"
      >
        Logout
      </button>
    </form>
  );
}
