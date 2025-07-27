import { createRootRouteWithContext, Outlet, useMatches } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { AnimatePresence } from 'framer-motion'
import { NavigationMenu, type NavigationMenu as NavigationMenuType } from '@/schemas/navigation.schemas'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { RouteTransition } from '@/components/RouteTransition'
import { SEO } from '@/components/SEO'

interface RouterContext {
  seo: SeoMetadata
  navigation: NavigationMenuType
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    const { NotFound } = require('@/components/NotFound')
    return <NotFound />
  }
})

function RootComponent() {
  const matches = useMatches()
  
  // Get the loader data from the leaf route
  const leafMatch = matches[matches.length - 1]
  const routeMeta = leafMatch?.loaderData?.meta as SeoMetadata | undefined

  return (
    <>
      <SEO metadata={routeMeta} />
      <div className='flex min-h-screen flex-col'>
        <Header />
        <main className='flex-1'>
          <AnimatePresence mode='wait'>
            <RouteTransition>
              <Outlet />
            </RouteTransition>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
      {process.env.NODE_ENV !== 'production' && <TanStackRouterDevtools position='bottom-right' />}
    </>
  )
}
