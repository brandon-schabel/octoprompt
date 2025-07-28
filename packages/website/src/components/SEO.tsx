import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'

interface SEOProps {
  metadata?: SeoMetadata
}

export function SEO({ metadata }: SEOProps) {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  useEffect(() => {
    if (!metadata) return

    // Update document title
    document.title = metadata.title

    // Update meta tags
    updateMetaTag('description', metadata.description)
    updateMetaTag('keywords', metadata.keywords?.join(', '))

    // Update Open Graph tags
    if (metadata.openGraph) {
      updateMetaTag('og:title', metadata.openGraph.title || metadata.title, 'property')
      updateMetaTag('og:description', metadata.openGraph.description || metadata.description, 'property')
      updateMetaTag('og:type', metadata.openGraph.type || 'website', 'property')
      updateMetaTag('og:url', metadata.openGraph.url || window.location.href, 'property')
      updateMetaTag('og:site_name', metadata.openGraph.siteName || 'Promptliano', 'property')

      if (metadata.openGraph.images?.[0]) {
        updateMetaTag('og:image', metadata.openGraph.images[0].url, 'property')
        updateMetaTag('og:image:width', metadata.openGraph.images[0].width?.toString(), 'property')
        updateMetaTag('og:image:height', metadata.openGraph.images[0].height?.toString(), 'property')
        updateMetaTag('og:image:alt', metadata.openGraph.images[0].alt, 'property')
      }
    }

    // Update Twitter tags
    if (metadata.twitter) {
      updateMetaTag('twitter:card', metadata.twitter.card || 'summary_large_image')
      updateMetaTag('twitter:title', metadata.twitter.title || metadata.title)
      updateMetaTag('twitter:description', metadata.twitter.description || metadata.description)
      updateMetaTag('twitter:image', metadata.twitter.image)
      updateMetaTag('twitter:site', metadata.twitter.site || '@promptliano')
    }

    // Update canonical URL
    updateLinkTag('canonical', metadata.canonical || window.location.href)
  }, [metadata, currentPath])

  return null
}

function updateMetaTag(name: string, content?: string, attribute: 'name' | 'property' = 'name') {
  if (!content) return

  let element = document.querySelector(`meta[${attribute}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}
