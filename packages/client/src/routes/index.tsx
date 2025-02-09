import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({
  component: LandingPage,
})

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative flex-1 flex items-center justify-center">
        {/* Animated gradient background with dark-mode adjustments */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 dark:from-gray-800 dark:via-gray-900 dark:to-black bg-[length:200%_200%] animate-gradient" />

        {/* Semi-opaque content container to improve contrast */}
        <main className="relative w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center bg-white/50 dark:bg-gray-800/80 backdrop-blur-sm rounded-md">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            Welcome to OctoPrompt
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            A local-first, TypeScript-powered AI companion for your development workflow.
            Manage code, generate prompts, and chat with powerful LLMs—all on your machine.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/projects">
              <Button size="lg">Projects</Button>
            </Link>
            <Link href="/chat">
              <Button size="lg" variant="outline">
                Chat
              </Button>
            </Link>
          </div>
          <p className="mt-6 max-w-lg mx-auto text-sm text-gray-500 dark:text-gray-400">
            Want advanced features like file summarization?
            Configure your provider keys under the{" "}
            <Link to="/keys" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
              Keys
            </Link>{" "}
            page.
          </p>
        </main>
      </div>
    </div>
  )
}