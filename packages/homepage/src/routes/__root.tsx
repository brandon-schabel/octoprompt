
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'


export const Route = createRootRouteWithContext()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {/* {process.env.NODE_ENV === 'development' && <TanStackRouterDevtools position="bottom-left" toggleButtonProps={{
        style: {

          marginLeft: '60px',
          marginBottom: "15px"
        }
      }} />} */}
    </div>
  )
}