export const metadata = { title: 'Job Finder' }

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: 16, background: '#fafafa', color: '#111' }}>
        {children}
      </body>
    </html>
  )
}
