import { PageTransition } from '@/components/ui'
import {
  HeroSection,
  FeaturesSection,
  QuickStartSection,
  MetricsSection,
  ComparisonTable
} from '@/components/sections'

export function LandingPage() {
  return (
    <PageTransition>
      <div className='min-h-screen bg-background overflow-x-hidden'>
        {/* Hero Section */}
        <HeroSection />

        {/* Comprehensive Features Section */}
        <FeaturesSection />

        {/* Quick Start Guide */}
        <QuickStartSection />

        {/* Metrics & Statistics */}
        <MetricsSection />

        {/* Comparison Table */}
        <ComparisonTable />
      </div>
    </PageTransition>
  )
}
