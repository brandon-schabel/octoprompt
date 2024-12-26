import { FeatureList } from "@/components/feature-list"
import { HomeNavbar } from "@/components/home-navbar"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute('/')({
  component: LandingPage,
})

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-auto">
      <HomeNavbar />
      <div className="bg-background flex-1">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:py-24 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              <span className="block">Code Meets Context:</span>
              <span className="block text-primary mt-2">Elevate Your Prompts.</span>
            </h1>
            <p className="mt-6 max-w-md mx-auto text-base text-muted-foreground sm:text-lg md:mt-8 md:text-xl md:max-w-3xl">
              Combine custom prompts with your project’s own files to rapidly refine code and streamline updates—all managed securely on your local machine, with no cloud dependency.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <a
                href="https://octoprompt.gumroad.com/l/octo-prompt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
              >
                I'm Interested
              </a>
            </div>
          </div>
        </div>
        <FeatureList />
      </div>
    </div>
  )
}



