function VinylLogo({ className = '', compact = false }) {
  return (
    <div
      className={`vinyl-logo ${compact ? 'compact' : ''} ${className}`.trim()}
      aria-label="Family Recipes"
      role="img"
    >
      <div className="vinyl-grooves" />
      <div className="vinyl-label">
        <img src="/pwa-192x192.png" alt="" />
      </div>
      <span className="vinyl-center-hole" />
    </div>
  )
}

export default VinylLogo
