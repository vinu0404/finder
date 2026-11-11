import './globals.css'

export const metadata = { title: 'Job Finder' }

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
