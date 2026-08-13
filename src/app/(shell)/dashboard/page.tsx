import { redirect } from "next/navigation";

// The dashboard moved to the app root, which is where sign-in now lands. This
// route stays behind as a permanent redirect so old links and bookmarks keep
// working.
export default function DashboardPage() {
  redirect("/");
}
