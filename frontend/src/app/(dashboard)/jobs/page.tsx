import { redirect } from "next/navigation"

export default function JobsPage() {
  // Redirect to the manage page by default
  redirect("/jobs/manage")
}
