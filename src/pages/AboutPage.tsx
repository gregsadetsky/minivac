export default function AboutPage() {
  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <a href="/" style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'white', textDecoration: 'none' }}>
          Minivac 601 Simulator
        </a>
        <nav>
          <a href="/simulator" style={{ color: 'white', textDecoration: 'none', marginLeft: '2rem' }}>
            Open Simulator
          </a>
          <a href="/about" style={{ color: 'white', textDecoration: 'none', marginLeft: '2rem' }}>
            About
          </a>
        </nav>
      </header>

      {/* Content Section */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '4rem 2rem',
        background: 'white',
        marginTop: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', fontWeight: 300, color: '#1a1a1a' }}>
          About the Minivac 601
        </h1>

        <p style={{ fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '1.5rem', color: '#333' }}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        </p>

        <p style={{ fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '1.5rem', color: '#333' }}>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
        </p>

        <p style={{ fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '1.5rem', color: '#333' }}>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '3rem 2rem',
        marginTop: '4rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '0.95rem', opacity: 0.8 }}>
          <p style={{ marginBottom: '0.5rem' }}>
            The Minivac 601 was created in 1961 by Claude Shannon and others as an educational computer kit.
            This simulator recreates the original hardware using accurate electrical simulation.{' '}
            <a href="/about" style={{ color: '#88c0d0', textDecoration: 'none' }}>Read more...</a>
          </p>
          <p style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.6 }}>
            A project by <a href="https://greg.technology" style={{ color: '#888', textDecoration: 'none' }}>Greg Technology</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
