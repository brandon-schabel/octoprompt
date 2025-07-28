import { PageTransition } from '@/components/ui'
import {
  HeroSection,
  FeatureShowcase,
  VisualShowcaseSection,
  McpIntegrationSection,
  QuickStartSection,
  MetricsSection,
  TestimonialsCarousel,
  ComparisonTable,
  FooterSection
} from '@/components/sections'

export function LandingPage() {
  return (
    <PageTransition>
      <div className='min-h-screen bg-background'>
        {/* Hero Section */}
        <HeroSection />

        {/* Feature Showcase */}
        <FeatureShowcase />

        {/* Visual Showcase */}
        <VisualShowcaseSection />

        {/* MCP Integration */}
        <McpIntegrationSection />

        {/* Quick Start Guide */}
        <QuickStartSection />

        {/* Metrics & Statistics */}
        <MetricsSection />

        {/* Testimonials */}
        <TestimonialsCarousel />

        {/* Comparison Table */}
        <ComparisonTable />

        {/* Footer */}
        <FooterSection />
      </div>
    </PageTransition>
  )
}
