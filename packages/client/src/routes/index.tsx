import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '@ui'
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/projects'
    })
  }
})
