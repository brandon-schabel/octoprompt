import { createFileRoute, Link } from "@tanstack/react-router"
import { HomeNavbar } from "@/components/app-home-navbar"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute('/')({
  component: LandingPage,
})

export default function LandingPage() {
  return (
    <>
      <HomeNavbar />

      {/* Minimal container */}
      <main className="max-w-3xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8 text-center">
        {/* Short title / tagline */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          Welcome to OctoPrompt
        </h1>

        {/* One-paragraph explanation */}
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          A local-first, TypeScript-powered AI companion for your development workflow.
          Manage code, generate prompts, and chat with powerful LLMs—all on your machine.
        </p>

        {/* Buttons: Projects & Chat */}
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/projects">
            <Button size="lg">Projects</Button>
          </Link>
          <Link href="/chat">
            <Button size="lg" variant="outline">Chat</Button>
          </Link>
        </div>

        {/* Mention Keys */}
        <p className="mt-6 max-w-lg mx-auto text-sm text-gray-500 dark:text-gray-400">
          Want advanced features like file summarization or voice input?
          Configure your provider keys under the{" "}
          <Link to="/keys" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
            Keys
          </Link>{" "}
          page.
        </p>
      </main>
    </>
  )
}