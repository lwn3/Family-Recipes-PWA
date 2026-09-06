import HomeView from './HomeView'
import RecipeLibrary from './RecipeLibrary'
import IngredientsLibrary from './IngredientsLibrary'

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'browse', label: 'Browse' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'meal-plans', label: 'Meal Plans' },
  { id: 'ingredients', label: 'Ingredients' },
]

function AppShell({
  activeProfile,
  currentView,
  onViewChange,
  onSwitchProfile,
}) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Family Recipes</h1>
          <button
            className="profile-button"
            onClick={onSwitchProfile}
          >
            {activeProfile.name}
          </button>
        </div>
      </header>

      <main className="app-content">
        {currentView === 'home' && (
            <HomeView activeProfile={activeProfile} />
            )}

        {currentView === 'browse' && (
            <RecipeLibrary activeProfile={activeProfile} />
            )}

        {currentView === 'favorites' && (
          <>
            <h2>Favorites</h2>
            <p>Your liked recipes will appear here.</p>
          </>
        )}

        {currentView === 'meal-plans' && (
          <>
            <h2>Meal Plans</h2>
            <p>Your recipe playlists and scheduled meal plans will live here.</p>
          </>
        )}

        {currentView === 'ingredients' && (
            <IngredientsLibrary />
         )}
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={currentView === item.id ? 'active' : ''}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default AppShell