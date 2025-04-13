/// <reference types="vite/client" />

interface Window {
  electron: any
  api: {
    fetchLinkMetadata: (url: string) => Promise<{
      url: string
      title: string
      description: string
      image: string | null
      domain: string
    }>
  }
}
