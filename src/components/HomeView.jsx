import { useMemo } from 'react'
import './VisualPolish.css'

function HomeView({ activeProfile }) {
  const dieValue = useMemo(
    () => Math.floor(Math.random() * 6) + 1,
    []
  )

  const dieDots = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  }

  return (
    <div className="home-view">
      <section className="home-hero home-hero-with-icon">
        <div>
          <p className="eyebrow">Now cooking with</p>
          <h2>{activeProfile.name}</h2>
          <p>Your family cookbook, meal planner, and grocery helper.</p>
        </div>

        <img
          className="home-brand-icon"
          src="/pwa-192x192.png"
          alt="Family Recipes"
        />
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h3>Recently Cooked</h3>
          <button>See all</button>
        </div>

        <div className="recipe-row">
          <div className="empty-card">
            <strong>No cooking history yet</strong>
            <span>Recipes you make will start appearing here.</span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{activeProfile.name}</p>
            <h3>Speed Dial</h3>
          </div>

          <button>See all</button>
        </div>

        <div className="speed-dial-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <button
              className="speed-dial-card placeholder-recipe"
              key={item}
            >
              <span className="recipe-label">Recipe</span>
            </button>
          ))}

          <button
            className="speed-dial-card random-recipe full-die"
            aria-label="Choose a random recipe"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => (
              <span
                key={position}
                className={
                  dieDots[dieValue].includes(position)
                    ? 'full-die-dot visible'
                    : 'full-die-dot'
                }
              />
            ))}
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h3>Albums</h3>
          <button>Browse</button>
        </div>

        <div className="album-grid">
          <button className="album-card">
            <strong>Instant Pot</strong>
            <span>Recipes</span>
          </button>

          <button className="album-card">
            <strong>Ground Beef</strong>
            <span>Recipes</span>
          </button>

          <button className="album-card">
            <strong>Party Food</strong>
            <span>Recipes</span>
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h3>Genres</h3>
          <button>Browse</button>
        </div>

        <div className="genre-row">
          <button>Dinner</button>
          <button>Breakfast</button>
          <button>Lunch</button>
          <button>Sides</button>
          <button>Dessert</button>
          <button>Snacks</button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h3>Meal Plans</h3>
          <button>See all</button>
        </div>

        <div className="playlist-card">
          <div>
            <strong>No playlists yet</strong>
            <span>Create a week of meals when you're ready.</span>
          </div>

          <button>+ New Meal Plan</button>
        </div>
      </section>
    </div>
  )
}

export default HomeView
