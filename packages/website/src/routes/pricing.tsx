import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'

export const Route = createFileRoute('/pricing')({
  loader: () => {
    return {
      meta: {
        title: 'Pricing - Promptliano',
        description: 'Simple, transparent pricing for Promptliano. Choose the plan that fits your needs.',
        keywords: ['pricing', 'plans', 'subscription', 'free', 'pro', 'enterprise']
      } as SeoMetadata
    }
  },
  component: PricingPage
})

interface PricingPlan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individual developers and small projects',
    features: [
      '1 active project',
      'Basic file suggestions',
      'Standard MCP integrations',
      'Community support',
      '100 AI interactions/month'
    ],
    cta: 'Get Started'
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    description: 'For professional developers and growing teams',
    features: [
      'Unlimited projects',
      'Advanced file suggestions',
      'All MCP integrations',
      'Priority support',
      'Unlimited AI interactions',
      'Custom prompts library',
      'Git worktree support',
      'Team collaboration (up to 5)'
    ],
    highlighted: true,
    cta: 'Start Free Trial'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For large teams with advanced requirements',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'SSO/SAML integration',
      'Advanced security features',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment option'
    ],
    cta: 'Contact Sales'
  }
]

function PricingPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Simple, Transparent Pricing</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className='grid md:grid-cols-3 gap-8 mb-16'>
          {plans.map((plan) => (
            <div key={plan.name} className={`relative ${plan.highlighted ? 'md:-mt-4 md:mb-4' : ''}`}>
              {plan.highlighted && (
                <div className='absolute -top-3 left-0 right-0 text-center'>
                  <span className='bg-primary text-primary-foreground text-sm px-4 py-1 rounded-full'>
                    Most Popular
                  </span>
                </div>
              )}
              <GlassCard className={`p-8 h-full ${plan.highlighted ? 'border-primary shadow-lg' : ''}`}>
                <div className='mb-6'>
                  <h3 className='text-2xl font-bold mb-2'>{plan.name}</h3>
                  <div className='flex items-baseline mb-4'>
                    <span className='text-4xl font-bold'>{plan.price}</span>
                    <span className='text-muted-foreground ml-2'>/{plan.period}</span>
                  </div>
                  <p className='text-muted-foreground'>{plan.description}</p>
                </div>

                <ul className='space-y-3 mb-8'>
                  {plan.features.map((feature, index) => (
                    <li key={index} className='flex items-start'>
                      <span className='text-primary mr-2'>✓</span>
                      <span className='text-sm'>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full btn ${plan.highlighted ? 'btn-primary' : 'btn-outline'}`}>{plan.cta}</button>
              </GlassCard>
            </div>
          ))}
        </div>

        <GlassCard className='p-8 mb-16'>
          <h2 className='text-2xl font-semibold mb-4 text-center'>Frequently Asked Questions</h2>
          <div className='grid md:grid-cols-2 gap-8'>
            <div>
              <h3 className='font-semibold mb-2'>Can I change plans anytime?</h3>
              <p className='text-muted-foreground'>
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className='font-semibold mb-2'>What payment methods do you accept?</h3>
              <p className='text-muted-foreground'>
                We accept all major credit cards, PayPal, and wire transfers for enterprise customers.
              </p>
            </div>
            <div>
              <h3 className='font-semibold mb-2'>Is there a free trial for Pro?</h3>
              <p className='text-muted-foreground'>
                Yes, we offer a 14-day free trial for the Pro plan. No credit card required.
              </p>
            </div>
            <div>
              <h3 className='font-semibold mb-2'>What happens to my data if I cancel?</h3>
              <p className='text-muted-foreground'>
                Your data remains accessible for 30 days after cancellation. You can export it anytime.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='text-center'>
          <p className='text-muted-foreground mb-4'>Have questions about pricing?</p>
          <a href='/community' className='btn btn-outline'>
            Contact Us
          </a>
        </div>
      </div>
    </div>
  )
}
